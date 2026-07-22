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
}

describe('RewardRule (e2e)', () => {
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
    // FK-safe order: reward rules reference campaigns, campaigns reference
    // organizations, all via onDelete: Restrict.
    await prisma.rewardRule.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.organization.deleteMany();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

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

  describe('POST /v1/reward-rules', () => {
    it('creates a fixed reward rule for an existing campaign', async () => {
      const campaign = await createActiveCampaign();

      const created = await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: 50 })
        .expect(201);

      expect(created.body).toMatchObject({
        campaignId: campaign.id,
        type: 'fixed',
        value: '50',
        campaign: { id: campaign.id, name: campaign.name },
      });
    });

    it('creates a percentage reward rule for an existing campaign', async () => {
      const campaign = await createActiveCampaign();

      const created = await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'percentage', value: 10 })
        .expect(201);

      expect(created.body).toMatchObject({
        campaignId: campaign.id,
        type: 'percentage',
        value: '10',
      });
    });

    it('rejects a reward rule for a campaign that does not exist', async () => {
      await server()
        .post('/v1/reward-rules')
        .send({
          campaignId: '00000000-0000-0000-0000-000000000000',
          type: 'fixed',
          value: 50,
        })
        .expect(404);
    });

    it('rejects a second reward rule for the same campaign', async () => {
      const campaign = await createActiveCampaign();
      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: 50 })
        .expect(201);

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: 75 })
        .expect(409);

      const count = await prisma.rewardRule.count({
        where: { campaignId: campaign.id },
      });
      expect(count).toBe(1);
    });

    it('rejects a negative fixed amount', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: -10 })
        .expect(400);
    });

    it('rejects a zero fixed amount', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: 0 })
        .expect(400);
    });

    it('rejects a zero percentage', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'percentage', value: 0 })
        .expect(400);
    });

    it('rejects a negative percentage', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'percentage', value: -5 })
        .expect(400);
    });

    it('rejects a percentage over 100', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'percentage', value: 101 })
        .expect(400);
    });

    it('accepts a percentage of exactly 100', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'percentage', value: 100 })
        .expect(201);
    });
  });

  describe('GET /v1/reward-rules/campaign/:campaignId', () => {
    it('retrieves an existing campaign reward rule', async () => {
      const campaign = await createActiveCampaign();
      await server()
        .post('/v1/reward-rules')
        .send({ campaignId: campaign.id, type: 'fixed', value: 50 })
        .expect(201);

      const fetched = await server()
        .get(`/v1/reward-rules/campaign/${campaign.id}`)
        .expect(200);

      expect(fetched.body).toMatchObject({
        campaignId: campaign.id,
        type: 'fixed',
        value: '50',
      });
    });

    it('returns 404 when the campaign has no reward rule', async () => {
      const campaign = await createActiveCampaign();

      await server()
        .get(`/v1/reward-rules/campaign/${campaign.id}`)
        .expect(404);
    });

    it('returns 404 when the campaign does not exist', () => {
      return server()
        .get('/v1/reward-rules/campaign/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
