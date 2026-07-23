import { RewardType } from '@prisma/client';
import { RewardCalculatorRegistry } from './reward-calculator.registry';
import { FixedRewardCalculator } from './fixed-reward.calculator';
import { PercentageRewardCalculator } from './percentage-reward.calculator';
import { RewardCalculator } from './reward-calculator.interface';

describe('RewardCalculatorRegistry', () => {
  it('resolves each RewardType to its own registered calculator', () => {
    const fixedRewardCalculator = {
      calculate: jest.fn(),
    } as unknown as FixedRewardCalculator;
    const percentageRewardCalculator = {
      calculate: jest.fn(),
    } as unknown as PercentageRewardCalculator;

    const registry = new RewardCalculatorRegistry(
      fixedRewardCalculator,
      percentageRewardCalculator,
    );

    const resolvedFixed: RewardCalculator = registry.get(RewardType.fixed);
    const resolvedPercentage: RewardCalculator = registry.get(
      RewardType.percentage,
    );

    expect(resolvedFixed).toBe(fixedRewardCalculator);
    expect(resolvedPercentage).toBe(percentageRewardCalculator);
  });
});
