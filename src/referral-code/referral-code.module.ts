import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { ReferralCodeController } from './referral-code.controller';
import { ReferralCodeService } from './referral-code.service';

@Module({
  imports: [CampaignModule],
  controllers: [ReferralCodeController],
  providers: [ReferralCodeService],
  exports: [ReferralCodeService],
})
export class ReferralCodeModule {}
