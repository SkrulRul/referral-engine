import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RewardRuleService } from './reward-rule.service';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { ProgramAdminAuthGuard } from '../auth/auth.guard';

@Controller({ path: 'reward-rules', version: '1' })
export class RewardRuleController {
  constructor(private readonly rewardRuleService: RewardRuleService) {}

  @Post()
  @UseGuards(ProgramAdminAuthGuard)
  create(@Body() dto: CreateRewardRuleDto) {
    return this.rewardRuleService.create(dto);
  }

  @Get('campaign/:campaignId')
  findByCampaign(@Param('campaignId') campaignId: string) {
    return this.rewardRuleService.findByCampaign(campaignId);
  }
}
