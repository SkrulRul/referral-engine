import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PayoutService } from './payout.service';

const SWEEP_INTERVAL_NAME = 'payout-sweep';

@Injectable()
export class PayoutSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutSweepService.name);

  constructor(
    private readonly payoutService: PayoutService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervalMs = parseInt(
      this.configService.get<string>('PAYOUT_SWEEP_INTERVAL_MS', '15000'),
      10,
    );

    const interval = setInterval(() => {
      this.sweep();
    }, intervalMs);

    this.schedulerRegistry.addInterval(SWEEP_INTERVAL_NAME, interval);
  }

  onModuleDestroy(): void {
    this.schedulerRegistry.deleteInterval(SWEEP_INTERVAL_NAME);
  }

  private sweep(): void {
    this.payoutService.sweepApprovedToPaid().catch((error: unknown) => {
      this.logger.warn(`Payout sweep failed: ${String(error)}`);
    });
  }
}
