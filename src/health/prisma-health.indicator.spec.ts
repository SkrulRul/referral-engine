import { Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    indicator = new PrismaHealthIndicator(
      prisma as unknown as PrismaService,
      new HealthIndicatorService(),
    );
  });

  it('reports up when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await indicator.isHealthy('database');

    expect(result).toEqual({ database: { status: 'up' } });
  });

  it('reports down with a generic message when the query fails, without leaking the driver error', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await indicator.isHealthy('database');

    expect(result).toEqual({
      database: { status: 'down', message: 'Database connection failed' },
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      'Database health check failed',
      expect.stringContaining('connection refused'),
    );

    loggerSpy.mockRestore();
  });
});
