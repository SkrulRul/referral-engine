import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateReferralCodeDto {
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @IsEmail()
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  referrerEmail!: string;
}
