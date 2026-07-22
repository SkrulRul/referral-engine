import { NotFoundException } from '@nestjs/common';
import { Payout, PayoutStatus } from '@prisma/client';
import { PayoutService } from './payout.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PayoutService', () => {
  let service: PayoutService;
  let prisma: {
    payout: { updateMany: jest.Mock; findUnique: jest.Mock };
  };

  const basePayout: Payout = {
    id: 'payout_1',
    referralId: 'referral_1',
    amount: 75 as unknown as Payout['amount'],
    status: PayoutStatus.pending,
    approvedAt: null,
    paidAt: null,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      payout: { updateMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new PayoutService(prisma as unknown as PrismaService);
  });

  describe('approve', () => {
    it('transitions a pending payout to approved and sets approvedAt', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.findUnique.mockResolvedValue({
        ...basePayout,
        status: PayoutStatus.approved,
        approvedAt: new Date('2026-07-22T12:00:00.000Z'),
      });

      const result = await service.approve('payout_1');

      expect(basePayout.approvedAt).toBeNull();
      expect(prisma.payout.updateMany).toHaveBeenCalledWith({
        where: { id: 'payout_1', status: PayoutStatus.pending },
        data: {
          status: PayoutStatus.approved,
          approvedAt: expect.any(Date) as Date,
        },
      });
      expect(result.status).toBe(PayoutStatus.approved);
      expect(result.approvedAt).not.toBeNull();
    });

    it('is a no-op that returns the unchanged record for an already-approved payout', async () => {
      const alreadyApproved = {
        ...basePayout,
        status: PayoutStatus.approved,
        approvedAt: new Date('2026-07-22T09:00:00.000Z'),
      };
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(alreadyApproved);

      const result = await service.approve('payout_1');

      expect(result).toEqual(alreadyApproved);
      expect(result.approvedAt).toEqual(alreadyApproved.approvedAt);
    });

    it('is a no-op that returns the unchanged record for an already-paid payout', async () => {
      const paid = {
        ...basePayout,
        status: PayoutStatus.paid,
        approvedAt: new Date('2026-07-22T09:00:00.000Z'),
        paidAt: new Date('2026-07-22T10:00:00.000Z'),
      };
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(paid);

      const result = await service.approve('payout_1');

      expect(result).toEqual(paid);
    });

    it('throws NotFoundException when the payout does not exist', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('pay', () => {
    it('transitions an approved payout to paid and sets paidAt', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.findUnique.mockResolvedValue({
        ...basePayout,
        status: PayoutStatus.paid,
        approvedAt: new Date('2026-07-22T09:00:00.000Z'),
        paidAt: new Date('2026-07-22T12:00:00.000Z'),
      });

      const result = await service.pay('payout_1');

      expect(prisma.payout.updateMany).toHaveBeenCalledWith({
        where: { id: 'payout_1', status: PayoutStatus.approved },
        data: {
          status: PayoutStatus.paid,
          paidAt: expect.any(Date) as Date,
        },
      });
      expect(result.status).toBe(PayoutStatus.paid);
      expect(result.paidAt).not.toBeNull();
    });

    it('is a no-op that returns the unchanged record for a still-pending payout', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(basePayout);

      const result = await service.pay('payout_1');

      expect(result).toEqual(basePayout);
      expect(result.paidAt).toBeNull();
    });

    it('is a no-op that returns the unchanged record for an already-paid payout', async () => {
      const paid = {
        ...basePayout,
        status: PayoutStatus.paid,
        paidAt: new Date('2026-07-22T10:00:00.000Z'),
      };
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(paid);

      const result = await service.pay('payout_1');

      expect(result).toEqual(paid);
    });

    it('throws NotFoundException when the payout does not exist', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.pay('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns the payout when it exists', async () => {
      prisma.payout.findUnique.mockResolvedValue(basePayout);

      const result = await service.findOne('payout_1');

      expect(result).toEqual(basePayout);
    });

    it('throws NotFoundException when the payout does not exist', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sweepApprovedToPaid', () => {
    it('bulk-transitions all approved payouts to paid with a shared paidAt', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 3 });

      await service.sweepApprovedToPaid();

      expect(prisma.payout.updateMany).toHaveBeenCalledWith({
        where: { status: PayoutStatus.approved },
        data: {
          status: PayoutStatus.paid,
          paidAt: expect.any(Date) as Date,
        },
      });
    });
  });
});
