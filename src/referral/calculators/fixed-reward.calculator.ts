import { Injectable } from '@nestjs/common';
import {
  RewardCalculationInput,
  RewardCalculationResult,
  RewardCalculator,
} from './reward-calculator.interface';

@Injectable()
export class FixedRewardCalculator implements RewardCalculator {
  calculate({ rewardRule }: RewardCalculationInput): RewardCalculationResult {
    return { amount: rewardRule.value };
  }
}
