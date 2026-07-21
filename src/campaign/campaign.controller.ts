import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller({ path: 'campaigns', version: '1' })
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.campaignService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignService.findOne(id);
  }
}
