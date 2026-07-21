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

describe('Organization + Campaign (e2e)', () => {
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
    // FK-safe order: campaigns reference organizations via onDelete: Restrict.
    await prisma.campaign.deleteMany();
    await prisma.organization.deleteMany();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  describe('/v1 versioning', () => {
    it('resolves organizations under the /v1 prefix', () => {
      return server().get('/v1/organizations').expect(200).expect([]);
    });

    it('does not resolve organizations without a version prefix', () => {
      return server().get('/organizations').expect(404);
    });
  });

  describe('organizations', () => {
    it('creates and persists an organization', async () => {
      const created = await server()
        .post('/v1/organizations')
        .send({ name: 'Acme Inc' })
        .expect(201);

      const createdBody = created.body as OrganizationResponseBody;
      expect(createdBody).toMatchObject({ name: 'Acme Inc' });
      expect(createdBody.id).toEqual(expect.any(String));

      await server()
        .get(`/v1/organizations/${createdBody.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ name: 'Acme Inc' });
        });
    });

    it('rejects an organization with a missing name and creates no partial record', async () => {
      await server().post('/v1/organizations').send({}).expect(400);

      await server().get('/v1/organizations').expect(200).expect([]);
    });

    it('lists existing organizations', async () => {
      await server().post('/v1/organizations').send({ name: 'Acme Inc' });
      await server().post('/v1/organizations').send({ name: 'Globex Corp' });

      const listed = await server().get('/v1/organizations').expect(200);

      expect(listed.body).toHaveLength(2);
    });
  });

  describe('campaigns', () => {
    async function createOrganization(name: string): Promise<string> {
      const response = await server()
        .post('/v1/organizations')
        .send({ name })
        .expect(201);
      return (response.body as OrganizationResponseBody).id;
    }

    it('creates a campaign linked to its organization', async () => {
      const organizationId = await createOrganization('Acme Inc');

      const created = await server()
        .post('/v1/campaigns')
        .send({
          name: 'Referral drive',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          organizationId,
        })
        .expect(201);

      expect(created.body).toMatchObject({
        name: 'Referral drive',
        organizationId,
        organization: { id: organizationId, name: 'Acme Inc' },
      });
    });

    it('rejects a campaign for a nonexistent organization and creates no partial record', async () => {
      await server()
        .post('/v1/campaigns')
        .send({
          name: 'Referral drive',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          organizationId: 'does-not-exist',
        })
        .expect(404);

      await server().get('/v1/campaigns').expect(200).expect([]);
    });

    it('rejects a campaign with inverted dates', async () => {
      const organizationId = await createOrganization('Acme Inc');

      await server()
        .post('/v1/campaigns')
        .send({
          name: 'Referral drive',
          startDate: '2026-01-31T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
          organizationId,
        })
        .expect(400);
    });

    it('rejects a campaign with a missing name', async () => {
      const organizationId = await createOrganization('Acme Inc');

      await server()
        .post('/v1/campaigns')
        .send({
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          organizationId,
        })
        .expect(400);
    });

    it('lists campaigns with an unambiguous link to their organization', async () => {
      const organizationId = await createOrganization('Acme Inc');
      await server().post('/v1/campaigns').send({
        name: 'Referral drive',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        organizationId,
      });

      const listed = await server().get('/v1/campaigns').expect(200);
      const listedBody = listed.body as CampaignResponseBody[];

      expect(listedBody).toHaveLength(1);
      expect(listedBody[0]).toMatchObject({
        organizationId,
        organization: { id: organizationId, name: 'Acme Inc' },
      });
    });

    it('returns 404 for a campaign that does not exist', () => {
      return server().get('/v1/campaigns/does-not-exist').expect(404);
    });
  });
});
