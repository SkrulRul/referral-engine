import { Transform } from 'class-transformer';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';

export class CreateReferralCodeDto {
  @IsUUID()
  campaignId!: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  referrerEmail!: string;
}
