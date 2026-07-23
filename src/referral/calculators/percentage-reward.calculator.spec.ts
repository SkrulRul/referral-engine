import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma, RewardRule, RewardType } from '@prisma/client';
import { PercentageRewardCalculator } from './percentage-reward.calculator';

describe('PercentageRewardCalculator', () => {
  const calculator = new PercentageRewardCalculator();

  it('computes the payout as a Decimal percentage of arr, rounded to 2 places', () => {
    const rewardRule = {
      type: RewardType.percentage,
      value: new Prisma.Decimal(12.5),
    } as RewardRule;

    const result = calculator.calculate({ rewardRule, arr: 1234.56 });

    expect(result.amount.toString()).toBe('154.32');
    expect(result.arr?.toString()).toBe('1234.56');
  });

  it('rejects conversion when arr is missing', () => {
    const rewardRule = {
      type: RewardType.percentage,
      value: new Prisma.Decimal(10),
    } as RewardRule;

    expect(() => calculator.calculate({ rewardRule })).toThrow(
      UnprocessableEntityException,
    );
  });
});
