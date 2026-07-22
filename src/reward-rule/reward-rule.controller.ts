import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RewardRuleService } from './reward-rule.service';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';

@Controller({ path: 'reward-rules', version: '1' })
export class RewardRuleController {
  constructor(private readonly rewardRuleService: RewardRuleService) {}

  @Post()
  create(@Body() dto: CreateRewardRuleDto) {
    return this.rewardRuleService.create(dto);
  }

  @Get('campaign/:campaignId')
  findByCampaign(@Param('campaignId') campaignId: string) {
    return this.rewardRuleService.findByCampaign(campaignId);
  }
}
