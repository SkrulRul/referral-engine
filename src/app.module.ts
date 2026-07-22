import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { OrganizationModule } from './organization/organization.module';
import { CampaignModule } from './campaign/campaign.module';
import { ReferralCodeModule } from './referral-code/referral-code.module';
import { ReferralModule } from './referral/referral.module';
import { RewardRuleModule } from './reward-rule/reward-rule.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    OrganizationModule,
    CampaignModule,
    ReferralCodeModule,
    ReferralModule,
    RewardRuleModule,
  ],
})
export class AppModule {}
