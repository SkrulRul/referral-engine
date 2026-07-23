import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { ReferralCodeModule } from '../referral-code/referral-code.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { FixedRewardCalculator } from './calculators/fixed-reward.calculator';
import { PercentageRewardCalculator } from './calculators/percentage-reward.calculator';
import { RewardCalculatorRegistry } from './calculators/reward-calculator.registry';

@Module({
  imports: [CampaignModule, ReferralCodeModule],
  controllers: [ReferralController],
  providers: [
    ReferralService,
    FixedRewardCalculator,
    PercentageRewardCalculator,
    RewardCalculatorRegistry,
  ],
  exports: [ReferralService],
})
export class ReferralModule {}
