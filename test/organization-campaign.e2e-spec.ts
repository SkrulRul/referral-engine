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

interface PaginatedResponseBody<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
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
      return server()
        .get('/v1/organizations')
        .expect(200)
        .expect({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        });
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

      const listed = await server().get('/v1/organizations').expect(200);
      const listedBody =
        listed.body as PaginatedResponseBody<OrganizationResponseBody>;

      expect(listedBody.data).toEqual([]);
      expect(listedBody.meta.total).toBe(0);
    });

    it('lists existing organizations with pagination metadata', async () => {
      await server().post('/v1/organizations').send({ name: 'Acme Inc' });
      await server().post('/v1/organizations').send({ name: 'Globex Corp' });

      const listed = await server().get('/v1/organizations').expect(200);
      const listedBody =
        listed.body as PaginatedResponseBody<OrganizationResponseBody>;

      expect(listedBody.data).toHaveLength(2);
      expect(listedBody.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('paginates organizations using the page and limit query params', async () => {
      await server().post('/v1/organizations').send({ name: 'Org A' });
      await server().post('/v1/organizations').send({ name: 'Org B' });
      await server().post('/v1/organizations').send({ name: 'Org C' });

      const firstPage = await server()
        .get('/v1/organizations?page=1&limit=2')
        .expect(200);
      const firstPageBody =
        firstPage.body as PaginatedResponseBody<OrganizationResponseBody>;

      expect(firstPageBody.data).toHaveLength(2);
      expect(firstPageBody.meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      const secondPage = await server()
        .get('/v1/organizations?page=2&limit=2')
        .expect(200);
      const secondPageBody =
        secondPage.body as PaginatedResponseBody<OrganizationResponseBody>;

      expect(secondPageBody.data).toHaveLength(1);
      expect(secondPageBody.meta).toEqual({
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
      });
    });

    it('rejects an out-of-range limit query param', () => {
      return server().get('/v1/organizations?limit=101').expect(400);
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

      const listed = await server().get('/v1/campaigns').expect(200);
      const listedBody =
        listed.body as PaginatedResponseBody<CampaignResponseBody>;

      expect(listedBody.data).toEqual([]);
      expect(listedBody.meta.total).toBe(0);
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
      const listedBody =
        listed.body as PaginatedResponseBody<CampaignResponseBody>;

      expect(listedBody.data).toHaveLength(1);
      expect(listedBody.data[0]).toMatchObject({
        organizationId,
        organization: { id: organizationId, name: 'Acme Inc' },
      });
      expect(listedBody.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('returns 404 for a campaign that does not exist', () => {
      return server().get('/v1/campaigns/does-not-exist').expect(404);
    });
  });
});
