import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { startMigratedPostgresContainer } from './support/postgres-test-container';

// Deliberately throws Prisma errors so the e2e suite can prove
// AllExceptionsFilter is wired into the real request pipeline, not just
// exercised as a plain unit under test. None of P2025/P2002/P2003 is
// reachable through actual Organization/Campaign domain logic yet.
@Controller({ path: '__test-errors', version: VERSION_NEUTRAL })
class TestErrorsController {
  @Get('mapped')
  throwMapped(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`name`)',
      { code: 'P2002', clientVersion: '7.8.0' },
    );
  }

  @Get('mapped-foreign-key')
  throwMappedForeignKey(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed on the field: `organization_id`',
      { code: 'P2003', clientVersion: '7.8.0' },
    );
  }

  @Get('unmapped')
  throwUnmapped(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'Null constraint violation on the field: `some_internal_field`',
      { code: 'P2011', clientVersion: '7.8.0' },
    );
  }
}

describe('AllExceptionsFilter (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    container = await startMigratedPostgresContainer();
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestErrorsController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('maps a Prisma P2002 error to 409 through the real request pipeline', () => {
    return server()
      .get('/__test-errors/mapped')
      .expect(409)
      .expect((res) => {
        expect(res.body).toMatchObject({ statusCode: 409 });
      });
  });

  it('maps a Prisma P2003 (foreign key) error to 409 through the real request pipeline', () => {
    return server()
      .get('/__test-errors/mapped-foreign-key')
      .expect(409)
      .expect((res) => {
        expect(res.body).toMatchObject({ statusCode: 409 });
      });
  });

  it('falls back an unmapped Prisma error code to a generic 500, without leaking driver details', () => {
    return server()
      .get('/__test-errors/unmapped')
      .expect(500)
      .expect((res) => {
        expect(res.body).toMatchObject({
          statusCode: 500,
          message: 'Internal server error',
        });
        expect(JSON.stringify(res.body)).not.toContain('some_internal_field');
      });
  });
});
