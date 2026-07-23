import { Prisma, RewardRule, RewardType } from '@prisma/client';
import { FixedRewardCalculator } from './fixed-reward.calculator';

describe('FixedRewardCalculator', () => {
  const calculator = new FixedRewardCalculator();

  it('uses the reward rule value directly, with no arr', () => {
    const rewardRule = {
      type: RewardType.fixed,
      value: new Prisma.Decimal(75),
    } as RewardRule;

    const result = calculator.calculate({ rewardRule });

    expect(result.amount.toString()).toBe('75');
    expect(result.arr).toBeUndefined();
  });
});
