import {
  IsEmail,
  IsEnum,
  IsISO4217CurrencyCode,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PayWithTashCustomerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;
}

export class CreatePayWithTashSessionDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsString()
  @MaxLength(120)
  merchantReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayWithTashCustomerDto)
  customer?: PayWithTashCustomerDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export enum PayWithTashPaymentMethodType {
  Wallet = 'wallet',
  Card = 'card',
  DirectDebit = 'direct_debit',
}

export class AuthorizePayWithTashSessionDto {
  @IsEnum(PayWithTashPaymentMethodType)
  paymentMethodType!: PayWithTashPaymentMethodType;

  @IsUUID()
  paymentMethodUuid!: string;

  @IsString()
  transactionPin!: string;
}
