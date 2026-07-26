import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';
import { createAuthenticatedProgramAdmin } from './support/auth-test-helper';

const KNOWN_PASSWORD = 'known-plaintext-password-123';
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

interface LoginResponseBody {
  accessToken: string;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
}

describe('Auth (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let organizationId: string;

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
    await prisma.programAdmin.deleteMany();
    await prisma.organization.deleteMany();

    const organization = await prisma.organization.create({
      data: { name: 'Auth Test Org' },
    });
    organizationId = organization.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function createProgramAdmin(email: string): Promise<void> {
    const passwordHash = await bcrypt.hash(KNOWN_PASSWORD, 10);
    await prisma.programAdmin.create({
      data: { email, passwordHash, organizationId },
    });
  }

  describe('POST /v1/auth/login', () => {
    it('returns an access token for valid credentials', async () => {
      const email = 'valid-admin@example.com';
      await createProgramAdmin(email);

      const response = await server()
        .post('/v1/auth/login')
        .send({ email, password: KNOWN_PASSWORD });

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);

      const body = response.body as LoginResponseBody;
      expect(typeof body.accessToken).toBe('string');
      expect(body.accessToken.length).toBeGreaterThan(0);
    });

    it('rejects a wrong password with a 401 in the uniform error shape', async () => {
      const email = 'wrong-password-admin@example.com';
      await createProgramAdmin(email);

      const response = await server()
        .post('/v1/auth/login')
        .send({ email, password: 'not-the-right-password' })
        .expect(401);

      const body = response.body as ErrorResponseBody;
      expect(body).toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
      });
    });

    it('rejects an unknown email with the same 401 message as a wrong password, for enumeration safety', async () => {
      const wrongPasswordResponse = await server()
        .post('/v1/auth/login')
        .send({ email: 'does-not-exist@example.com', password: 'anything' })
        .expect(401);

      const email = 'enumeration-admin@example.com';
      await createProgramAdmin(email);
      const unknownEmailResponse = await server()
        .post('/v1/auth/login')
        .send({
          email: 'still-does-not-exist@example.com',
          password: 'anything',
        })
        .expect(401);

      const wrongPasswordBody = wrongPasswordResponse.body as ErrorResponseBody;
      const unknownEmailBody = unknownEmailResponse.body as ErrorResponseBody;

      expect(unknownEmailBody.statusCode).toBe(wrongPasswordBody.statusCode);
      expect(unknownEmailBody.message).toBe(wrongPasswordBody.message);
      expect(unknownEmailBody.error).toBe(wrongPasswordBody.error);
    });

    it('rejects a login request with a missing password field', async () => {
      await server()
        .post('/v1/auth/login')
        .send({ email: 'missing-password@example.com' })
        .expect(400);
    });

    it('rejects a login request with a missing email field', async () => {
      await server()
        .post('/v1/auth/login')
        .send({ password: KNOWN_PASSWORD })
        .expect(400);
    });
  });

  describe('protected endpoints reject requests without a token', () => {
    it('rejects POST /v1/campaigns with no Authorization header', () => {
      return server()
        .post('/v1/campaigns')
        .send({
          name: 'Referral drive',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          organizationId,
        })
        .expect(401);
    });

    it('rejects POST /v1/reward-rules with no Authorization header', () => {
      return server()
        .post('/v1/reward-rules')
        .send({
          campaignId: UNKNOWN_UUID,
          type: 'FIXED',
          value: 10,
        })
        .expect(401);
    });

    it('rejects PATCH /v1/payouts/:id/approve with no Authorization header', () => {
      return server().patch(`/v1/payouts/${UNKNOWN_UUID}/approve`).expect(401);
    });

    it('rejects PATCH /v1/payouts/:id/pay with no Authorization header', () => {
      return server().patch(`/v1/payouts/${UNKNOWN_UUID}/pay`).expect(401);
    });
  });

  describe('tampered token rejection', () => {
    it('rejects a token with a mutated signature segment', async () => {
      const { accessToken } = await createAuthenticatedProgramAdmin(
        app,
        prisma,
        organizationId,
      );

      const segments = accessToken.split('.');
      const signature = segments[segments.length - 1];
      const tamperedSignature =
        signature.slice(0, -4) +
        (signature.slice(-4) === 'aaaa' ? 'bbbb' : 'aaaa');
      segments[segments.length - 1] = tamperedSignature;
      const tamperedToken = segments.join('.');

      await server()
        .post('/v1/campaigns')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .send({
          name: 'Referral drive',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          organizationId,
        })
        .expect(401);
    });
  });
});
