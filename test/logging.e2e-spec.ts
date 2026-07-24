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
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { StructuredLoggerService } from '../src/logging/structured-logger.service';
import { startMigratedPostgresContainer } from './support/postgres-test-container';

// Deliberately throws a raw, non-HttpException, non-Prisma error so this
// suite can prove correlation survives into AllExceptionsFilter's generic
// "Unhandled exception" branch — a log source unrelated to the middleware.
@Controller({ path: '__test-logging-errors', version: VERSION_NEUTRAL })
class TestLoggingErrorsController {
  @Get('boom')
  throwRaw(): never {
    throw new Error('boom');
  }
}

const CORRELATION_HEADER = 'x-correlation-id';

function captureJsonLines(
  ...writeMocks: { mock: { calls: unknown[][] } }[]
): Record<string, unknown>[] {
  return writeMocks
    .flatMap((writeMock) => writeMock.mock.calls)
    .map((call) => String(call[0]).trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

function spyOnLogStreams(): {
  stdout: jest.SpyInstance;
  stderr: jest.SpyInstance;
  restore: () => void;
} {
  const stdout = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  const stderr = jest
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);

  return {
    stdout,
    stderr,
    restore: () => {
      stdout.mockRestore();
      stderr.mockRestore();
    },
  };
}

describe('Structured logging & request correlation (e2e)', () => {
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
      controllers: [TestLoggingErrorsController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(new StructuredLoggerService());
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('generates a correlation id when the caller supplies none', async () => {
    const response = await server().get('/v1/organizations').expect(200);

    expect(response.headers[CORRELATION_HEADER]).toBeTruthy();
  });

  it('echoes back a caller-supplied correlation id verbatim', async () => {
    const response = await server()
      .get('/v1/organizations')
      .set(CORRELATION_HEADER, 'caller-supplied-id')
      .expect(200);

    expect(response.headers[CORRELATION_HEADER]).toBe('caller-supplied-id');
  });

  it("the middleware's completion log line carries the same correlation id as the response header", async () => {
    const { stdout, stderr, restore } = spyOnLogStreams();

    const response = await server().get('/v1/organizations').expect(200);
    const logged = captureJsonLines(stdout, stderr);
    restore();

    const correlationId = response.headers[CORRELATION_HEADER];
    const completionLine = logged.find(
      (line) => line.message === 'Request completed',
    );

    expect(completionLine?.correlationId).toBe(correlationId);
  });

  it('a downstream log line from AllExceptionsFilter carries the same correlation id as the response header, proving cross-source correlation', async () => {
    // The filter logs at 'error' level, which ConsoleLogger writes to
    // stderr, not stdout — both streams must be captured or this line
    // is silently missed.
    const { stdout, stderr, restore } = spyOnLogStreams();

    const response = await server()
      .get('/__test-logging-errors/boom')
      .expect(500);
    const logged = captureJsonLines(stdout, stderr);
    restore();

    const correlationId = response.headers[CORRELATION_HEADER];
    expect(correlationId).toBeTruthy();

    const filterLine = logged.find(
      (line) =>
        line.context === 'AllExceptionsFilter' &&
        line.message === 'Unhandled exception',
    );

    expect(filterLine).toBeDefined();
    expect(filterLine?.correlationId).toBe(correlationId);
  });
});
