import { Injectable, NotFoundException } from '@nestjs/common';
import { RewardRule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';

const REWARD_RULE_WITH_CAMPAIGN = {
  include: { campaign: { select: { id: true, name: true } } },
} as const;

@Injectable()
export class RewardRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignService: CampaignService,
  ) {}

  async create(dto: CreateRewardRuleDto): Promise<RewardRule> {
    await this.campaignService.findOne(dto.campaignId);

    return this.prisma.rewardRule.create({
      data: {
        campaignId: dto.campaignId,
        type: dto.type,
        value: dto.value,
      },
      ...REWARD_RULE_WITH_CAMPAIGN,
    });
  }

  async findByCampaign(campaignId: string): Promise<RewardRule> {
    const rewardRule = await this.prisma.rewardRule.findUnique({
      where: { campaignId },
      ...REWARD_RULE_WITH_CAMPAIGN,
    });

    if (!rewardRule) {
      throw new NotFoundException(`Campaign ${campaignId} has no reward rule`);
    }

    return rewardRule;
  }
}
