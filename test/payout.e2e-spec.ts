import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PayoutService } from '../src/payout/payout.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';

interface OrganizationResponseBody {
  id: string;
}

interface CampaignResponseBody {
  id: string;
  name: string;
}

interface ReferralCodeResponseBody {
  id: string;
  code: string;
}

interface ReferralResponseBody {
  id: string;
  status: string;
  payout?: { id: string } | null;
}

interface PayoutResponseBody {
  id: string;
  referralId: string;
  amount: string;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
}

async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // FK-safe order: payouts reference referrals, referrals reference
  // referral codes, referral codes and reward rules reference campaigns,
  // campaigns reference organizations, all via onDelete: Restrict.
  await prisma.payout.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.rewardRule.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.organization.deleteMany();
}

function buildFixtures(server: () => ReturnType<typeof request>) {
  async function createActiveCampaign(
    name = 'Referral drive',
  ): Promise<CampaignResponseBody> {
    const organization = await server()
      .post('/v1/organizations')
      .send({ name: 'Acme Inc' })
      .expect(201);
    const organizationId = (organization.body as OrganizationResponseBody).id;
    const now = Date.now();

    const response = await server()
      .post('/v1/campaigns')
      .send({
        name,
        startDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        organizationId,
      })
      .expect(201);

    return response.body as CampaignResponseBody;
  }

  async function createRewardRule(
    campaignId: string,
    value = 75,
  ): Promise<void> {
    await server()
      .post('/v1/reward-rules')
      .send({ campaignId, type: 'fixed', value })
      .expect(201);
  }

  async function createReferralCode(
    campaignId: string,
    referrerEmail = 'referrer@example.com',
  ): Promise<ReferralCodeResponseBody> {
    const response = await server()
      .post('/v1/referral-codes')
      .send({ campaignId, referrerEmail })
      .expect(201);
    return response.body as ReferralCodeResponseBody;
  }

  async function createConvertedReferral(
    referralCodeCode: string,
    refereeEmail = 'referee@example.com',
  ): Promise<ReferralResponseBody> {
    const created = await server()
      .post('/v1/referrals')
      .send({
        referralCode: referralCodeCode,
        refereeEmail,
        refereeName: 'Referee Name',
      })
      .expect(201);
    const referral = created.body as ReferralResponseBody;

    const converted = await server()
      .patch(`/v1/referrals/${referral.id}/convert`)
      .expect(200);
    return converted.body as ReferralResponseBody;
  }

  async function createPendingPayout(): Promise<string> {
    const campaign = await createActiveCampaign();
    await createRewardRule(campaign.id);
    const referralCode = await createReferralCode(campaign.id);
    const referral = await createConvertedReferral(referralCode.code);

    if (!referral.payout) {
      throw new Error('Expected a payout to be created on conversion');
    }

    return referral.payout.id;
  }

  async function createApprovedPayout(): Promise<string> {
    const payoutId = await createPendingPayout();
    await server().patch(`/v1/payouts/${payoutId}/approve`).expect(200);
    return payoutId;
  }

  return { createPendingPayout, createApprovedPayout };
}

describe('Payout (e2e)', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await startMigratedPostgresContainer();
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  describe('shared app', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      configureApp(app);
      await app.init();

      prisma = app.get(PrismaService);
      await cleanDatabase(prisma);
    });

    afterEach(async () => {
      await app.close();
    });

    const server = () => request(app.getHttpServer());
    const fixtures = buildFixtures(server);

    describe('PATCH /v1/payouts/:id/approve', () => {
      it('approves a pending payout and records approvedAt', async () => {
        const payoutId = await fixtures.createPendingPayout();

        const approved = await server()
          .patch(`/v1/payouts/${payoutId}/approve`)
          .expect(200);
        const body = approved.body as PayoutResponseBody;

        expect(body.status).toBe('approved');
        expect(body.approvedAt).not.toBeNull();
      });

      it('is an idempotent no-op when approving an already-approved payout', async () => {
        const payoutId = await fixtures.createApprovedPayout();
        const before = await server()
          .get(`/v1/payouts/${payoutId}`)
          .expect(200);
        const approvedAtBefore = (before.body as PayoutResponseBody).approvedAt;

        const again = await server()
          .patch(`/v1/payouts/${payoutId}/approve`)
          .expect(200);
        const body = again.body as PayoutResponseBody;

        expect(body.status).toBe('approved');
        expect(body.approvedAt).toBe(approvedAtBefore);
      });

      it('is a no-op with no destructive effect when approving an already-paid payout', async () => {
        const payoutId = await fixtures.createApprovedPayout();
        await server().patch(`/v1/payouts/${payoutId}/pay`).expect(200);

        const again = await server()
          .patch(`/v1/payouts/${payoutId}/approve`)
          .expect(200);
        const body = again.body as PayoutResponseBody;

        expect(body.status).toBe('paid');
      });

      it('returns 404 for a payout that does not exist', () => {
        return server()
          .patch('/v1/payouts/00000000-0000-0000-0000-000000000000/approve')
          .expect(404);
      });

      it('returns 400 for a malformed (non-UUID) id', () => {
        return server().patch('/v1/payouts/not-a-uuid/approve').expect(400);
      });
    });

    describe('PATCH /v1/payouts/:id/pay', () => {
      it('pays an approved payout and records paidAt', async () => {
        const payoutId = await fixtures.createApprovedPayout();

        const paid = await server()
          .patch(`/v1/payouts/${payoutId}/pay`)
          .expect(200);
        const body = paid.body as PayoutResponseBody;

        expect(body.status).toBe('paid');
        expect(body.paidAt).not.toBeNull();
      });

      it('is a no-op that leaves a still-pending payout unpaid', async () => {
        const payoutId = await fixtures.createPendingPayout();

        const result = await server()
          .patch(`/v1/payouts/${payoutId}/pay`)
          .expect(200);
        const body = result.body as PayoutResponseBody;

        expect(body.status).toBe('pending');
        expect(body.paidAt).toBeNull();
      });

      it('is an idempotent no-op when paying an already-paid payout', async () => {
        const payoutId = await fixtures.createApprovedPayout();
        const first = await server()
          .patch(`/v1/payouts/${payoutId}/pay`)
          .expect(200);
        const paidAtBefore = (first.body as PayoutResponseBody).paidAt;

        const second = await server()
          .patch(`/v1/payouts/${payoutId}/pay`)
          .expect(200);
        const body = second.body as PayoutResponseBody;

        expect(body.status).toBe('paid');
        expect(body.paidAt).toBe(paidAtBefore);
      });

      it('returns 404 for a payout that does not exist', () => {
        return server()
          .patch('/v1/payouts/00000000-0000-0000-0000-000000000000/pay')
          .expect(404);
      });

      it('returns 400 for a malformed (non-UUID) id', () => {
        return server().patch('/v1/payouts/not-a-uuid/pay').expect(400);
      });
    });

    describe('concurrency: scheduled sweep racing a manual pay call', () => {
      it('is safe when the sweep and several manual pay calls target the same approved payout at once', async () => {
        const payoutId = await fixtures.createApprovedPayout();
        const payoutService = app.get(PayoutService);

        const manualPayCalls = Array.from({ length: 5 }, () =>
          server().patch(`/v1/payouts/${payoutId}/pay`),
        );

        const [manualPayResponses] = await Promise.all([
          Promise.all(manualPayCalls),
          payoutService.sweepApprovedToPaid(),
        ]);

        for (const response of manualPayResponses) {
          expect(response.status).toBe(200);
          expect((response.body as PayoutResponseBody).status).toBe('paid');
        }

        const fetched = await server()
          .get(`/v1/payouts/${payoutId}`)
          .expect(200);
        const finalBody = fetched.body as PayoutResponseBody;
        expect(finalBody.status).toBe('paid');
        expect(finalBody.paidAt).not.toBeNull();

        // No double-processing: the payout row is never duplicated, and every
        // racing caller converges on the exact same paidAt, proving only one
        // of the concurrent writers actually performed the transition.
        const payoutCount = await prisma.payout.count({
          where: { id: payoutId },
        });
        expect(payoutCount).toBe(1);

        const distinctPaidAts = new Set(
          manualPayResponses.map(
            (response) => (response.body as PayoutResponseBody).paidAt,
          ),
        );
        expect(distinctPaidAts.size).toBe(1);
      });
    });

    describe('GET /v1/payouts/:id', () => {
      it('retrieves a payout with its accurate status and timestamps', async () => {
        const payoutId = await fixtures.createApprovedPayout();

        const fetched = await server()
          .get(`/v1/payouts/${payoutId}`)
          .expect(200);
        const body = fetched.body as PayoutResponseBody;

        expect(body).toMatchObject({ id: payoutId, status: 'approved' });
        expect(body.approvedAt).not.toBeNull();
        expect(body.paidAt).toBeNull();
      });

      it('returns 404 for a payout that does not exist', () => {
        return server()
          .get('/v1/payouts/00000000-0000-0000-0000-000000000000')
          .expect(404);
      });

      it('returns 400 for a malformed (non-UUID) id', () => {
        return server().get('/v1/payouts/not-a-uuid').expect(400);
      });
    });
  });

  // Isolated from the shared-app describe above: this block boots its own
  // Nest app with a short PAYOUT_SWEEP_INTERVAL_MS set before init, and
  // tears it down (closing the app clears the registered interval via
  // Nest's SchedulerRegistry) so the fast sweep never bleeds into the
  // shared-app tests' assertions above.
  describe('automatic sweep', () => {
    let app: INestApplication<App>;
    let originalIntervalEnv: string | undefined;

    beforeAll(async () => {
      originalIntervalEnv = process.env.PAYOUT_SWEEP_INTERVAL_MS;
      process.env.PAYOUT_SWEEP_INTERVAL_MS = '200';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      configureApp(app);
      await app.init();

      await cleanDatabase(app.get(PrismaService));
    }, 30_000);

    afterAll(async () => {
      await app.close();

      if (originalIntervalEnv === undefined) {
        delete process.env.PAYOUT_SWEEP_INTERVAL_MS;
      } else {
        process.env.PAYOUT_SWEEP_INTERVAL_MS = originalIntervalEnv;
      }
    });

    it('marks an approved payout as paid automatically, without manual action', async () => {
      const server = () => request(app.getHttpServer());
      const fixtures = buildFixtures(server);
      const payoutId = await fixtures.createApprovedPayout();

      const deadline = Date.now() + 10_000;
      let status = 'approved';

      while (Date.now() < deadline) {
        const response = await server()
          .get(`/v1/payouts/${payoutId}`)
          .expect(200);
        status = (response.body as PayoutResponseBody).status;

        if (status === 'paid') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(status).toBe('paid');
    }, 15_000);
  });
});
