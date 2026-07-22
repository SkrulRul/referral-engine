import { Controller, Get, Param, Patch } from '@nestjs/common';
import { PayoutService } from './payout.service';

@Controller({ path: 'payouts', version: '1' })
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.payoutService.approve(id);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string) {
    return this.payoutService.pay(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payoutService.findOne(id);
  }
}
