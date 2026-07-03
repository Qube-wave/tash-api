import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDirectDebitMandateDto {
  @IsString()
  @MaxLength(20)
  bankCode!: string;

  @IsString()
  @MaxLength(20)
  accountNumber!: string;

  @IsString()
  @MaxLength(120)
  accountName!: string;

  @IsInt()
  @Min(1)
  maximumAmount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;
}

export class AuthorizeDirectDebitMandateDto {
  @IsString()
  @MaxLength(120)
  authorizationReference!: string;
}

export class FundWalletWithDirectDebitDto {
  @IsString()
  mandateUuid!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsString()
  transactionPin!: string;
}

export class RevokeDirectDebitMandateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
