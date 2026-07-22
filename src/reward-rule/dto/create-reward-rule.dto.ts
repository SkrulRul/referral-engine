import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { RewardType } from '@prisma/client';
import { IsValidRewardValue } from '../validators/reward-value.validator';

export class CreateRewardRuleDto {
  @IsUUID()
  campaignId!: string;

  @IsEnum(RewardType)
  type!: RewardType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsValidRewardValue('type')
  value!: number;
}
