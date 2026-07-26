import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaign/campaign.module';
import { RewardRuleController } from './reward-rule.controller';
import { RewardRuleService } from './reward-rule.service';

@Module({
  imports: [CampaignModule, AuthModule],
  controllers: [RewardRuleController],
  providers: [RewardRuleService],
})
export class RewardRuleModule {}
