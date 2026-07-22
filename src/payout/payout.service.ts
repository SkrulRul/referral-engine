import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Payout, PayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  async approve(id: string): Promise<Payout> {
    await this.prisma.payout.updateMany({
      where: { id, status: PayoutStatus.pending },
      data: { status: PayoutStatus.approved, approvedAt: new Date() },
    });

    return this.findOne(id);
  }

  async pay(id: string): Promise<Payout> {
    // Paying a payout that isn't currently approved (still pending, or
    // already paid) is a deliberate no-op, not an error: it mirrors
    // approve()'s no-op-on-wrong-state contract so repeated/out-of-order
    // calls are always safe, never destructive.
    await this.prisma.payout.updateMany({
      where: { id, status: PayoutStatus.approved },
      data: { status: PayoutStatus.paid, paidAt: new Date() },
    });

    return this.findOne(id);
  }

  async findOne(id: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id } });

    if (!payout) {
      throw new NotFoundException(`Payout ${id} not found`);
    }

    return payout;
  }

  async sweepApprovedToPaid(): Promise<void> {
    const result = await this.prisma.payout.updateMany({
      where: { status: PayoutStatus.approved },
      data: { status: PayoutStatus.paid, paidAt: new Date() },
    });

    if (result.count > 0) {
      this.logger.log(`Swept ${result.count} approved payout(s) to paid`);
    }
  }
}
