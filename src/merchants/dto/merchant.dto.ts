import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MerchantApiKeyEnvironment } from '../entities/merchant-api-key.entity';

export class CreateMerchantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(32)
  phoneNumber!: string;

  @IsString()
  @MaxLength(80)
  businessType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @IsISO31661Alpha2()
  country!: string;

  @IsISO4217CurrencyCode()
  defaultCurrency!: string;
}

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;
}

export class UpdateMerchantSettingsDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  allowedRedirectUrls?: string[];

  @IsOptional()
  @IsBoolean()
  allowCardPayments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDirectDebitPayments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowWalletPayments?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  checkoutName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  checkoutDescription?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  checkoutLogoUrl?: string | null;
}

export class CreateMerchantApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEnum(MerchantApiKeyEnvironment)
  environment!: MerchantApiKeyEnvironment;
}
