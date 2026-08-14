import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ReferralCodeService } from './referral-code.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';

@Controller({ path: 'referral-codes', version: '1' })
export class ReferralCodeController {
  constructor(private readonly referralCodeService: ReferralCodeService) {}

  @UseGuards(ThrottlerGuard)
  @Post()
  create(@Body() dto: CreateReferralCodeDto) {
    return this.referralCodeService.create(dto);
  }

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.referralCodeService.findByCode(code);
  }
}
