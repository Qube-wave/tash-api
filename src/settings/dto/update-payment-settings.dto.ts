import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({
    name: 'defaultCardId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultCardId?: number | null;

  @ApiPropertyOptional({
    name: 'defaultDirectDebitMandateId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultDirectDebitMandateId?: number | null;

  @ApiPropertyOptional({
    name: 'defaultWalletId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultWalletId?: number | null;

  @ApiPropertyOptional({
    name: 'requireTransactionPin',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  requireTransactionPin?: boolean;

  @ApiPropertyOptional({
    name: 'allowCardPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowCardPayments?: boolean;

  @ApiPropertyOptional({
    name: 'allowDirectDebitPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowDirectDebitPayments?: boolean;

  @ApiPropertyOptional({
    name: 'allowWalletPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowWalletPayments?: boolean;

  @ApiPropertyOptional({
    name: 'allowMerchantPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowMerchantPayments?: boolean;

  @ApiPropertyOptional({
    name: 'dailyTransferLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyTransferLimit?: number;

  @ApiPropertyOptional({
    name: 'dailyPaymentLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyPaymentLimit?: number;

  @ApiPropertyOptional({
    name: 'singleTransactionLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  singleTransactionLimit?: number;

  @ApiPropertyOptional({
    name: 'notificationPreferences',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, unknown>;
}
