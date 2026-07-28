import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';
import { createAuthenticatedProgramAdmin } from './support/auth-test-helper';

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

describe('ReferralCode (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;

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
    // FK-safe order: referral codes reference campaigns, campaigns reference
    // organizations, both via onDelete: Restrict.
    await prisma.referralCode.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.programAdmin.deleteMany();
    await prisma.organization.deleteMany();

    const authOrg = await prisma.organization.create({
      data: { name: 'Auth Org' },
    });
    ({ accessToken } = await createAuthenticatedProgramAdmin(
      app,
      prisma,
      authOrg.id,
    ));
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const authenticatedServer = () =>
    request
      .agent(app.getHttpServer())
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Connection', 'close');

  async function createOrganization(name: string): Promise<string> {
    const response = await server()
      .post('/v1/organizations')
      .send({ name })
      .expect(201);
    return (response.body as OrganizationResponseBody).id;
  }

  async function createCampaign(
    organizationId: string,
    options: { name?: string; startDate?: Date; endDate?: Date } = {},
  ): Promise<CampaignResponseBody> {
    const now = Date.now();
    const {
      name = 'Referral drive',
      startDate = new Date(now - 24 * 60 * 60 * 1000),
      endDate = new Date(now + 24 * 60 * 60 * 1000),
    } = options;

    const response = await authenticatedServer()
      .post('/v1/campaigns')
      .send({
        name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        organizationId,
      })
      .expect(201);

    return response.body as CampaignResponseBody;
  }

  async function createActiveCampaign(
    name = 'Referral drive',
  ): Promise<CampaignResponseBody> {
    const organizationId = await createOrganization('Acme Inc');
    return createCampaign(organizationId, { name });
  }

  describe('POST /v1/referral-codes', () => {
    it('issues a referral code for a valid campaign and referrer', async () => {
      const campaign = await createActiveCampaign();

      const created = await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer@example.com',
        })
        .expect(201);

      const createdBody = created.body as ReferralCodeResponseBody;
      expect(createdBody).toMatchObject({
        code: expect.any(String) as string,
        campaignId: campaign.id,
        referrerEmail: 'referrer@example.com',
        campaign: { id: campaign.id, name: campaign.name },
      });
    });

    it('issues distinct codes for two different referrers on the same campaign', async () => {
      const campaign = await createActiveCampaign();

      const first = await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer-a@example.com',
        })
        .expect(201);
      const second = await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer-b@example.com',
        })
        .expect(201);

      const firstBody = first.body as ReferralCodeResponseBody;
      const secondBody = second.body as ReferralCodeResponseBody;
      expect(firstBody.code).not.toEqual(secondBody.code);
    });

    it('returns the same code when the same referrer requests twice for the same campaign', async () => {
      const campaign = await createActiveCampaign();
      const payload = {
        campaignId: campaign.id,
        referrerEmail: 'repeat-referrer@example.com',
      };

      const first = await server()
        .post('/v1/referral-codes')
        .send(payload)
        .expect(201);
      const second = await server()
        .post('/v1/referral-codes')
        .send(payload)
        .expect(201);

      const firstBody = first.body as ReferralCodeResponseBody;
      const secondBody = second.body as ReferralCodeResponseBody;
      expect(secondBody.code).toEqual(firstBody.code);
    });

    it('rejects a nonexistent campaign and creates no partial record', async () => {
      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: '00000000-0000-0000-0000-000000000000',
          referrerEmail: 'referrer@example.com',
        })
        .expect(404);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a malformed campaignId and creates no partial record', async () => {
      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: 'not-a-uuid',
          referrerEmail: 'referrer@example.com',
        })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a referrerEmail over 254 characters and creates no partial record', async () => {
      const campaign = await createActiveCampaign();
      const overlongLocalPart = 'a'.repeat(255 - '@example.com'.length + 1);

      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: `${overlongLocalPart}@example.com`,
        })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a campaign that has not started yet and creates no row', async () => {
      const now = Date.now();
      const organizationId = await createOrganization('Acme Inc');
      const campaign = await createCampaign(organizationId, {
        startDate: new Date(now + 24 * 60 * 60 * 1000),
        endDate: new Date(now + 48 * 60 * 60 * 1000),
      });

      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer@example.com',
        })
        .expect(422);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a campaign that has already ended and creates no row', async () => {
      const now = Date.now();
      const organizationId = await createOrganization('Acme Inc');
      const campaign = await createCampaign(organizationId, {
        startDate: new Date(now - 48 * 60 * 60 * 1000),
        endDate: new Date(now - 24 * 60 * 60 * 1000),
      });

      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer@example.com',
        })
        .expect(422);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects an invalid email and creates no row', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/referral-codes')
        .send({ campaignId: campaign.id, referrerEmail: 'not-an-email' })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a missing campaignId and creates no row', async () => {
      await server()
        .post('/v1/referral-codes')
        .send({ referrerEmail: 'referrer@example.com' })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects a missing referrerEmail and creates no row', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/referral-codes')
        .send({ campaignId: campaign.id })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('rejects an extra undeclared field and creates no row', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer@example.com',
          foo: 'bar',
        })
        .expect(400);

      const count = await prisma.referralCode.count();
      expect(count).toBe(0);
    });

    it('creates exactly one row when the same referrer fires concurrent identical requests', async () => {
      const campaign = await createActiveCampaign();
      const payload = {
        campaignId: campaign.id,
        referrerEmail: 'concurrent-referrer@example.com',
      };

      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          server().post('/v1/referral-codes').send(payload),
        ),
      );

      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      const codes = new Set(
        responses.map(
          (response) => (response.body as ReferralCodeResponseBody).code,
        ),
      );
      expect(codes.size).toBe(1);

      const count = await prisma.referralCode.count({
        where: {
          campaignId: campaign.id,
          referrerEmail: payload.referrerEmail,
        },
      });
      expect(count).toBe(1);
    });
  });

  describe('GET /v1/referral-codes/:code', () => {
    it('retrieves an existing referral code with its campaign', async () => {
      const campaign = await createActiveCampaign();
      const created = await server()
        .post('/v1/referral-codes')
        .send({
          campaignId: campaign.id,
          referrerEmail: 'referrer@example.com',
        })
        .expect(201);
      const createdBody = created.body as ReferralCodeResponseBody;

      const fetched = await server()
        .get(`/v1/referral-codes/${createdBody.code}`)
        .expect(200);

      expect(fetched.body).toMatchObject({
        code: createdBody.code,
        campaignId: campaign.id,
        referrerEmail: 'referrer@example.com',
        campaign: { id: campaign.id, name: campaign.name },
      });
    });

    it('returns 404 for a referral code that does not exist', () => {
      return server().get('/v1/referral-codes/does-not-exist').expect(404);
    });
  });
});
