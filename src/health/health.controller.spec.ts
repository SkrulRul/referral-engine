import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };
  let prismaHealthIndicator: { isHealthy: jest.Mock };

  beforeEach(async () => {
    healthCheckService = { check: jest.fn() };
    prismaHealthIndicator = { isHealthy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: PrismaHealthIndicator, useValue: prismaHealthIndicator },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('runs the health check with the prisma indicator', async () => {
    const expected = { status: 'ok', info: {}, error: {}, details: {} };
    healthCheckService.check.mockImplementation(
      async (checks: Array<() => unknown>) => {
        await Promise.all(checks.map((check) => check()));
        return expected;
      },
    );

    const result = await controller.check();

    expect(prismaHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
    expect(result).toBe(expected);
  });
});
