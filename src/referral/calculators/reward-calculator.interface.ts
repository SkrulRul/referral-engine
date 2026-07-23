import { Prisma, RewardRule } from '@prisma/client';

export interface RewardCalculationInput {
  rewardRule: RewardRule;
  arr?: number;
}

export interface RewardCalculationResult {
  amount: Prisma.Decimal;
  arr?: Prisma.Decimal;
}

// This makes amount computation extensible per RewardType. It does NOT
// generalize audit-field persistence: applyConversion() and the Referral.arr
// column are still coupled to today's two types' shape (one optional
// Decimal). A future type needing a different audit surface would still
// require touching applyConversion + schema — a separate, narrower
// extension point this refactor deliberately does not solve ahead of a real
// second need.
export interface RewardCalculator {
  calculate(input: RewardCalculationInput): RewardCalculationResult;
}
