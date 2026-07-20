import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';
import { IsAfter } from '../validators/is-after.validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @IsDate()
  @Type(() => Date)
  @IsAfter('startDate')
  endDate!: Date;

  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
