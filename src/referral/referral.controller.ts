import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ReferralService } from './referral.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ConvertReferralDto } from './dto/convert-referral.dto';

@Controller({ path: 'referrals', version: '1' })
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @UseGuards(ThrottlerGuard)
  @Post()
  register(@Body() dto: CreateReferralDto) {
    return this.referralService.register(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referralService.findOne(id);
  }

  @Patch(':id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertReferralDto) {
    return this.referralService.convert(id, dto);
  }

  @Get(':id/payout')
  findPayout(@Param('id') id: string) {
    return this.referralService.findPayout(id);
  }
}
