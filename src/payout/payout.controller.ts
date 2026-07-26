import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PayoutService } from './payout.service';
import { ProgramAdminAuthGuard } from '../auth/auth.guard';

@Controller({ path: 'payouts', version: '1' })
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Patch(':id/approve')
  @UseGuards(ProgramAdminAuthGuard)
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.payoutService.approve(id);
  }

  @Patch(':id/pay')
  @UseGuards(ProgramAdminAuthGuard)
  pay(@Param('id', ParseUUIDPipe) id: string) {
    return this.payoutService.pay(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payoutService.findOne(id);
  }
}
