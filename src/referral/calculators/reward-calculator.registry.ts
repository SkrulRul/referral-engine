import { Injectable } from '@nestjs/common';
import { RewardType } from '@prisma/client';
import { RewardCalculator } from './reward-calculator.interface';
import { FixedRewardCalculator } from './fixed-reward.calculator';
import { PercentageRewardCalculator } from './percentage-reward.calculator';

@Injectable()
export class RewardCalculatorRegistry {
  private readonly calculators: Record<RewardType, RewardCalculator>;

  constructor(
    fixedRewardCalculator: FixedRewardCalculator,
    percentageRewardCalculator: PercentageRewardCalculator,
  ) {
    this.calculators = {
      [RewardType.fixed]: fixedRewardCalculator,
      [RewardType.percentage]: percentageRewardCalculator,
    };
  }

  get(type: RewardType): RewardCalculator {
    return this.calculators[type];
  }
}
