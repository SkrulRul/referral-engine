import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { PayoutSweepService } from './payout-sweep.service';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule],
  controllers: [PayoutController],
  providers: [PayoutService, PayoutSweepService],
  exports: [PayoutService],
})
export class PayoutModule {}
