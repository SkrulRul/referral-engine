import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';

describe('Rate limiting (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let campaignId: string;
  let referralCodeValue: string;

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
    // FK-safe order: payouts reference referrals, referrals reference
    // referral codes, referral codes reference campaigns, campaigns
    // reference organizations, all via onDelete: Restrict.
    await prisma.payout.deleteMany();
    await prisma.referral.deleteMany();
    await prisma.referralCode.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.programAdmin.deleteMany();
    await prisma.organization.deleteMany();

    const organization = await prisma.organization.create({
      data: { name: 'Rate Limit Org' },
    });
    const now = Date.now();
    const campaign = await prisma.campaign.create({
      data: {
        name: 'Rate Limit Campaign',
        startDate: new Date(now - 24 * 60 * 60 * 1000),
        endDate: new Date(now + 24 * 60 * 60 * 1000),
        organizationId: organization.id,
      },
    });
    campaignId = campaign.id;

    const referralCode = await prisma.referralCode.create({
      data: {
        code: 'rlfixed1',
        campaignId: campaign.id,
        referrerEmail: 'referrer@example.com',
      },
    });
    referralCodeValue = referralCode.code;
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  describe('POST /v1/referral-codes', () => {
    it('allows 20 requests per window and blocks the 21st with a 429', async () => {
      for (let attempt = 1; attempt <= 20; attempt++) {
        await server()
          .post('/v1/referral-codes')
          .send({ campaignId, referrerEmail: 'throttled-referrer@example.com' })
          .expect(201);
      }

      const blocked = await server()
        .post('/v1/referral-codes')
        .send({ campaignId, referrerEmail: 'throttled-referrer@example.com' })
        .expect(429);

      expect(blocked.body).toMatchObject({
        statusCode: 429,
        message: expect.any(String) as string,
      });
      expect(blocked.headers['retry-after']).toBeDefined();
    });
  });

  describe('POST /v1/referrals', () => {
    it('allows 20 requests per window and blocks the 21st with a 429', async () => {
      for (let attempt = 1; attempt <= 20; attempt++) {
        await server()
          .post('/v1/referrals')
          .send({
            referralCode: referralCodeValue,
            refereeEmail: 'throttled-referee@example.com',
            refereeName: 'Referee Name',
          })
          .expect(201);
      }

      const blocked = await server()
        .post('/v1/referrals')
        .send({
          referralCode: referralCodeValue,
          refereeEmail: 'throttled-referee@example.com',
          refereeName: 'Referee Name',
        })
        .expect(429);

      expect(blocked.body).toMatchObject({
        statusCode: 429,
        message: expect.any(String) as string,
      });
      expect(blocked.headers['retry-after']).toBeDefined();
    });
  });

  describe('scope boundary', () => {
    it('does not apply the guard globally, so an unthrottled GET endpoint is unaffected', async () => {
      for (let attempt = 1; attempt <= 25; attempt++) {
        await server()
          .get(`/v1/referral-codes/${referralCodeValue}`)
          .expect(200);
      }
    });
  });
});
