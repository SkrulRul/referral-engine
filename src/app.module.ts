import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { CampaignModule } from './campaign/campaign.module';
import { ReferralCodeModule } from './referral-code/referral-code.module';
import { ReferralModule } from './referral/referral.module';
import { RewardRuleModule } from './reward-rule/reward-rule.module';
import { PayoutModule } from './payout/payout.module';
import { CorrelationIdMiddleware } from './logging/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    CampaignModule,
    ReferralCodeModule,
    ReferralModule,
    RewardRuleModule,
    PayoutModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
