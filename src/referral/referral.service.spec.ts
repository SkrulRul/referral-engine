import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma, ReferralStatus, RewardType } from '@prisma/client';
import { ReferralService } from './referral.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ReferralCodeService } from '../referral-code/referral-code.service';
import { ConvertReferralDto } from './dto/convert-referral.dto';

interface PayoutCreateArgs {
  data: { referralId: string; amount: Prisma.Decimal; status: string };
}

interface ReferralUpdateManyArgs {
  data: { status: string; arr?: Prisma.Decimal };
}

interface Tx {
  referral: { updateMany: jest.Mock };
  payout: { create: jest.Mock };
}

describe('ReferralService', () => {
  let service: ReferralService;
  let payoutCreate: jest.Mock<Promise<unknown>, [PayoutCreateArgs]>;
  let referralUpdateMany: jest.Mock<
    Promise<{ count: number }>,
    [ReferralUpdateManyArgs]
  >;
  let prisma: {
    referral: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const pendingReferralWithRewardRule = (rewardRule: {
    type: RewardType;
    value: Prisma.Decimal;
  }) => ({
    id: 'referral_1',
    status: ReferralStatus.pending,
    referralCode: {
      campaign: { rewardRule },
    },
  });

  beforeEach(() => {
    payoutCreate = jest
      .fn<Promise<unknown>, [PayoutCreateArgs]>()
      .mockResolvedValue({});
    referralUpdateMany = jest
      .fn<Promise<{ count: number }>, [ReferralUpdateManyArgs]>()
      .mockResolvedValue({ count: 1 });
    const tx: Tx = {
      referral: { updateMany: referralUpdateMany },
      payout: { create: payoutCreate },
    };

    prisma = {
      referral: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'referral_1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: Tx) => Promise<void>) =>
          callback(tx),
        ),
    };

    service = new ReferralService(
      prisma as unknown as PrismaService,
      {} as CampaignService,
      {} as ReferralCodeService,
    );
  });

  describe('convert — percentage reward rule', () => {
    it('computes the payout as a Decimal percentage of arr, rounded to 2 places', async () => {
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule({
          type: RewardType.percentage,
          value: new Prisma.Decimal(12.5),
        }),
      );
      const dto: ConvertReferralDto = { arr: 1234.56 };

      await service.convert('referral_1', dto);

      const [payoutArgs] = payoutCreate.mock.calls[0];
      expect(payoutArgs.data.referralId).toBe('referral_1');
      expect(payoutArgs.data.amount.toString()).toBe('154.32');

      const [referralArgs] = referralUpdateMany.mock.calls[0];
      expect(referralArgs.data.status).toBe(ReferralStatus.converted);
      expect(referralArgs.data.arr?.toString()).toBe('1234.56');
    });

    it('rejects conversion when arr is missing, without touching the transaction', async () => {
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule({
          type: RewardType.percentage,
          value: new Prisma.Decimal(10),
        }),
      );

      await expect(service.convert('referral_1', {})).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('convert — fixed reward rule', () => {
    it('uses the reward rule value directly and ignores a stray arr', async () => {
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule({
          type: RewardType.fixed,
          value: new Prisma.Decimal(75),
        }),
      );
      const dto: ConvertReferralDto = { arr: 1234.56 };

      await service.convert('referral_1', dto);

      const [payoutArgs] = payoutCreate.mock.calls[0];
      expect(payoutArgs.data.amount.toString()).toBe('75');

      const [referralArgs] = referralUpdateMany.mock.calls[0];
      expect(referralArgs.data.arr).toBeUndefined();
    });
  });
});
