import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

  @Patch(':id/convert')
  convert(@Param('id') id: string) {
    return this.referralService.convert(id);
  }

  @Get(':id/payout')
  findPayout(@Param('id') id: string) {
    return this.referralService.findPayout(id);
  }
}
