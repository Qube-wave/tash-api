import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @ApiProperty({
    name: 'defaultCardId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultCardId?: number | null;

  @ApiProperty({
    name: 'defaultDirectDebitMandateId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultDirectDebitMandateId?: number | null;

  @ApiProperty({
    name: 'defaultWalletId',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  defaultWalletId?: number | null;

  @ApiProperty({
    name: 'requireTransactionPin',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  requireTransactionPin?: boolean;

  @ApiProperty({
    name: 'allowCardPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowCardPayments?: boolean;

  @ApiProperty({
    name: 'allowDirectDebitPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowDirectDebitPayments?: boolean;

  @ApiProperty({
    name: 'allowWalletPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowWalletPayments?: boolean;

  @ApiProperty({
    name: 'allowMerchantPayments',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  allowMerchantPayments?: boolean;

  @ApiProperty({
    name: 'dailyTransferLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyTransferLimit?: number;

  @ApiProperty({
    name: 'dailyPaymentLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyPaymentLimit?: number;

  @ApiProperty({
    name: 'singleTransactionLimit',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  singleTransactionLimit?: number;

  @ApiProperty({
    name: 'notificationPreferences',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, unknown>;
}
