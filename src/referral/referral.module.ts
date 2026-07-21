import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { ReferralCodeModule } from '../referral-code/referral-code.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [CampaignModule, ReferralCodeModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
