import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';

interface OrganizationResponseBody {
  id: string;
  name: string;
}

interface CampaignResponseBody {
  id: string;
  name: string;
  organizationId: string;
  organization: { id: string; name: string };
}

interface ReferralCodeResponseBody {
  id: string;
  code: string;
  campaignId: string;
  referrerEmail: string;
  campaign: { id: string; name: string };
}

interface ReferralResponseBody {
  id: string;
  referralCodeId: string;
  refereeEmail: string;
  refereeName: string;
  status: string;
  referralCode: {
    id: string;
    code: string;
    campaign: { id: string; name: string };
  };
}

describe('Referral (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    container = await startMigratedPostgresContainer();
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    // FK-safe order: referrals reference referral codes, referral codes
    // reference campaigns, campaigns reference organizations, all via
    // onDelete: Restrict.
    await prisma.referral.deleteMany();
    await prisma.referralCode.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.organization.deleteMany();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function createOrganization(name: string): Promise<string> {
    const response = await server()
      .post('/v1/organizations')
      .send({ name })
      .expect(201);
    return (response.body as OrganizationResponseBody).id;
  }

  async function createActiveCampaign(
    name = 'Referral drive',
  ): Promise<CampaignResponseBody> {
    const organizationId = await createOrganization('Acme Inc');
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

  describe('POST /v1/referrals', () => {
    it('registers a referral for a valid, active referral code', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      const created = await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(201);

      const createdBody = created.body as ReferralResponseBody;
      expect(createdBody).toMatchObject({
        referralCodeId: referralCode.id,
        refereeEmail: 'referee@example.com',
        refereeName: 'Referee Name',
        status: 'pending',
        referralCode: {
          id: referralCode.id,
          code: referralCode.code,
          campaign: { id: campaign.id, name: campaign.name },
        },
      });
    });

    it('rejects a nonexistent referral code and creates no row', async () => {
      await server()
        .post('/v1/referrals')
        .send({
          referralCode: 'does-not-exist',
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(404);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a referral code whose campaign has not started yet and creates no row', async () => {
      // A code can only ever be issued while its campaign is active, so we
      // issue it first, then move the campaign's window into the future to
      // simulate time passing before this (now stale) code is used.
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const now = Date.now();
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          startDate: new Date(now + 24 * 60 * 60 * 1000),
          endDate: new Date(now + 48 * 60 * 60 * 1000),
        },
      });

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(422);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a referral code whose campaign has already ended and creates no row', async () => {
      // Same reasoning as above: issue while active, then simulate the
      // campaign having since ended.
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const now = Date.now();
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          startDate: new Date(now - 48 * 60 * 60 * 1000),
          endDate: new Date(now - 24 * 60 * 60 * 1000),
        },
      });

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(422);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('creates only one referral when the same referee submits the same code twice', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const payload = {
        referralCode: referralCode.code,
        refereeEmail: 'repeat-referee@example.com',
        refereeName: 'Referee Name',
      };

      const first = await server()
        .post('/v1/referrals')
        .send(payload)
        .expect(201);
      const second = await server()
        .post('/v1/referrals')
        .send(payload)
        .expect(201);

      const firstBody = first.body as ReferralResponseBody;
      const secondBody = second.body as ReferralResponseBody;
      expect(secondBody.id).toEqual(firstBody.id);

      const count = await prisma.referral.count({
        where: { referralCodeId: referralCode.id },
      });
      expect(count).toBe(1);
    });

    it('allows the same referee to register with a different valid referral code', async () => {
      const campaign = await createActiveCampaign();
      const firstReferralCode = await createReferralCode(
        campaign.id,
        'referrer-a@example.com',
      );
      const secondReferralCode = await createReferralCode(
        campaign.id,
        'referrer-b@example.com',
      );
      const refereeEmail = 'same-referee@example.com';

      const first = await server()
        .post('/v1/referrals')
        .send({
          referralCode: firstReferralCode.code,
          refereeEmail,
          refereeName: 'Referee Name',
        })
        .expect(201);
      const second = await server()
        .post('/v1/referrals')
        .send({
          referralCode: secondReferralCode.code,
          refereeEmail,
          refereeName: 'Referee Name',
        })
        .expect(201);

      const firstBody = first.body as ReferralResponseBody;
      const secondBody = second.body as ReferralResponseBody;
      expect(secondBody.id).not.toEqual(firstBody.id);

      const count = await prisma.referral.count({
        where: { refereeEmail },
      });
      expect(count).toBe(2);
    });

    it('creates exactly one row when the same referee fires concurrent identical requests', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const payload = {
        referralCode: referralCode.code,
        refereeEmail: 'concurrent-referee@example.com',
        refereeName: 'Referee Name',
      };

      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          server().post('/v1/referrals').send(payload),
        ),
      );

      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      const ids = new Set(
        responses.map((response) => (response.body as ReferralResponseBody).id),
      );
      expect(ids.size).toBe(1);

      const count = await prisma.referral.count({
        where: {
          referralCodeId: referralCode.id,
          refereeEmail: payload.refereeEmail,
        },
      });
      expect(count).toBe(1);
    });

    it('rejects a missing referralCode and creates no row', async () => {
      await server()
        .post('/v1/referrals')
        .send({
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a missing refereeEmail and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      await server()
        .post('/v1/referrals')
        .send({ referralCode: referralCode.code, refereeName: 'Referee Name' })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a missing refereeName and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects an invalid email and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'not-an-email',
          refereeName: 'Referee Name',
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a refereeEmail over 254 characters and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const overlongLocalPart = 'a'.repeat(255 - '@example.com'.length + 1);

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: `${overlongLocalPart}@example.com`,
          refereeName: 'Referee Name',
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects a refereeName over 255 characters and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'a'.repeat(256),
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });

    it('rejects an extra undeclared field and creates no row', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);

      await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
          foo: 'bar',
        })
        .expect(400);

      const count = await prisma.referral.count();
      expect(count).toBe(0);
    });
  });

  describe('GET /v1/referrals/:id', () => {
    it('retrieves an existing referral with its status, referral code, and campaign', async () => {
      const campaign = await createActiveCampaign();
      const referralCode = await createReferralCode(campaign.id);
      const created = await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCode.code,
          refereeEmail: 'referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(201);
      const createdBody = created.body as ReferralResponseBody;

      const fetched = await server()
        .get(`/v1/referrals/${createdBody.id}`)
        .expect(200);

      expect(fetched.body).toMatchObject({
        id: createdBody.id,
        status: 'pending',
        referralCode: {
          id: referralCode.id,
          code: referralCode.code,
          campaign: { id: campaign.id, name: campaign.name },
        },
      });
    });

    it('returns 404 for a referral that does not exist', () => {
      return server()
        .get('/v1/referrals/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
