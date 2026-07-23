import { PayoutSweepService } from './payout-sweep.service';
import { PayoutService } from './payout.service';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('PayoutSweepService', () => {
  let service: PayoutSweepService;
  let payoutService: { sweepApprovedToPaid: jest.Mock };
  let configService: { get: jest.Mock };
  let schedulerRegistry: { addInterval: jest.Mock; deleteInterval: jest.Mock };

  beforeEach(() => {
    payoutService = {
      sweepApprovedToPaid: jest.fn().mockResolvedValue(undefined),
    };
    configService = { get: jest.fn() };
    schedulerRegistry = { addInterval: jest.fn(), deleteInterval: jest.fn() };
    service = new PayoutSweepService(
      payoutService as unknown as PayoutService,
      configService as unknown as ConfigService,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads PAYOUT_SWEEP_INTERVAL_MS with a 15000ms default and registers an interval', () => {
    configService.get.mockReturnValue('15000');
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    service.onModuleInit();

    expect(configService.get).toHaveBeenCalledWith(
      'PAYOUT_SWEEP_INTERVAL_MS',
      '15000',
    );
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
    expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
      'payout-sweep',
      expect.anything(),
    );
  });

  it('parses a configured interval value to a number', () => {
    configService.get.mockReturnValue('250');
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    service.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 250);
  });

  it('invokes sweepApprovedToPaid on each tick', () => {
    configService.get.mockReturnValue('100');
    jest.useFakeTimers();

    service.onModuleInit();
    jest.advanceTimersByTime(300);

    expect(payoutService.sweepApprovedToPaid).toHaveBeenCalledTimes(3);
  });

  it('clears the registered interval on module destroy', () => {
    service.onModuleDestroy();

    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
      'payout-sweep',
    );
  });
});
