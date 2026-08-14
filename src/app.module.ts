import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
    // ThrottlerModule is @Global() internally, so ThrottlerGuard/ThrottlerStorage
    // are DI-resolvable from feature modules without importing ThrottlerModule
    // there too (unlike this repo's AuthModule, which feature modules import
    // explicitly). Applied per-route via @UseGuards, not as an APP_GUARD.
    //
    // Keys by req.ip. configure-app.ts never sets `trust proxy`, so behind a
    // real reverse proxy/load balancer every caller collapses into one shared
    // bucket. Deliberately not set here: guessing the deployment topology
    // wrong makes X-Forwarded-For spoofable, which is worse than the limit
    // it's meant to fix. Whoever deploys this must configure `trust proxy`
    // for the real topology or accept this as a known limitation.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
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
