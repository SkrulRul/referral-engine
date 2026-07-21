import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { CreateReferralDto } from './dto/create-referral.dto';

@Controller({ path: 'referrals', version: '1' })
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post()
  register(@Body() dto: CreateReferralDto) {
    return this.referralService.register(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referralService.findOne(id);
  }
}
