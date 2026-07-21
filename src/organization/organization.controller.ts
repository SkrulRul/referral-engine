import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }
}
