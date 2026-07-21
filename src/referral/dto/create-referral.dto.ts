import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateReferralDto {
  @IsString()
  @Length(8, 8)
  referralCode!: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  refereeEmail!: string;

  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value.trim())
  refereeName!: string;
}
