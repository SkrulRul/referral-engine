import { IsNumber, IsOptional, IsPositive, Max } from 'class-validator';

export class ConvertReferralDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(99999999.99)
  arr?: number;
}
