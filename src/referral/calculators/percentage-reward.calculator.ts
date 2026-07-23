import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RewardCalculationInput,
  RewardCalculationResult,
  RewardCalculator,
} from './reward-calculator.interface';

@Injectable()
export class PercentageRewardCalculator implements RewardCalculator {
  calculate({
    rewardRule,
    arr,
  }: RewardCalculationInput): RewardCalculationResult {
    if (arr === undefined) {
      throw new UnprocessableEntityException(
        'ARR is required to convert a referral under a percentage reward rule',
      );
    }

    const arrDecimal = new Prisma.Decimal(arr);
    // arr's @Max bound (ConvertReferralDto) only fully protects
    // Payout.amount from overflow because percentage reward values are
    // separately capped at 100 (IsValidRewardValueConstraint) — if that
    // cap is ever loosened, arr's max needs re-deriving.
    const amount = arrDecimal.mul(rewardRule.value).div(100).toDecimalPlaces(2);

    return { amount, arr: arrDecimal };
  }
}
