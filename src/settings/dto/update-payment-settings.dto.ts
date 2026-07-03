import { IsBoolean, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsInt()
  defaultCardId?: number | null;

  @IsOptional()
  @IsInt()
  defaultDirectDebitMandateId?: number | null;

  @IsOptional()
  @IsInt()
  defaultWalletId?: number | null;

  @IsOptional()
  @IsBoolean()
  requireTransactionPin?: boolean;

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
  @IsBoolean()
  allowMerchantPayments?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyTransferLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyPaymentLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  singleTransactionLimit?: number;

  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, unknown>;
}
