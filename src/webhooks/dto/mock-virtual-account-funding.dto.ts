import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class MockVirtualAccountFundingWebhookDto {
  @IsString()
  @MaxLength(120)
  providerEventId!: string;

  @IsString()
  @MaxLength(120)
  providerReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountNumber?: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;
}
