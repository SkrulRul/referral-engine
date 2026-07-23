import { Prisma, ReferralStatus, RewardType } from '@prisma/client';
import { ReferralService } from './referral.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ReferralCodeService } from '../referral-code/referral-code.service';
import { RewardCalculatorRegistry } from './calculators/reward-calculator.registry';
import { RewardCalculationResult } from './calculators/reward-calculator.interface';

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
  let rewardCalculatorRegistry: { get: jest.Mock };

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
    rewardCalculatorRegistry = { get: jest.fn() };

    service = new ReferralService(
      prisma as unknown as PrismaService,
      {} as CampaignService,
      {} as ReferralCodeService,
      rewardCalculatorRegistry as unknown as RewardCalculatorRegistry,
    );
  });

  describe('convert', () => {
    it("resolves the calculator for the referral's reward rule type", async () => {
      const rewardRule = {
        type: RewardType.percentage,
        value: new Prisma.Decimal(10),
      };
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule(rewardRule),
      );
      rewardCalculatorRegistry.get.mockReturnValue({
        calculate: jest
          .fn()
          .mockReturnValue({ amount: new Prisma.Decimal(15) }),
      });

      await service.convert('referral_1', { arr: 150 });

      expect(rewardCalculatorRegistry.get).toHaveBeenCalledWith(
        RewardType.percentage,
      );
    });

    it('persists exactly what the resolved calculator returns', async () => {
      const rewardRule = {
        type: RewardType.percentage,
        value: new Prisma.Decimal(10),
      };
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule(rewardRule),
      );
      const calculationResult: RewardCalculationResult = {
        amount: new Prisma.Decimal(154.32),
        arr: new Prisma.Decimal(1234.56),
      };
      rewardCalculatorRegistry.get.mockReturnValue({
        calculate: jest.fn().mockReturnValue(calculationResult),
      });

      await service.convert('referral_1', { arr: 1234.56 });

      const [payoutArgs] = payoutCreate.mock.calls[0];
      expect(payoutArgs.data.referralId).toBe('referral_1');
      expect(payoutArgs.data.amount).toBe(calculationResult.amount);

      const [referralArgs] = referralUpdateMany.mock.calls[0];
      expect(referralArgs.data.status).toBe(ReferralStatus.converted);
      expect(referralArgs.data.arr).toBe(calculationResult.arr);
    });

    it('propagates a calculator exception without touching the transaction', async () => {
      const rewardRule = {
        type: RewardType.percentage,
        value: new Prisma.Decimal(10),
      };
      prisma.referral.findUnique.mockResolvedValue(
        pendingReferralWithRewardRule(rewardRule),
      );
      const calculatorError = new Error('missing arr');
      rewardCalculatorRegistry.get.mockReturnValue({
        calculate: jest.fn().mockImplementation(() => {
          throw calculatorError;
        }),
      });

      await expect(service.convert('referral_1', {})).rejects.toThrow(
        calculatorError,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
