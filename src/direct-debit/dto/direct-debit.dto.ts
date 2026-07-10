import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDirectDebitMandateDto {
  @ApiProperty({
    description: 'Recipient bank code selected from the banks endpoint.',
    example: '058',
  })
  @IsString()
  @MaxLength(20)
  bankCode!: string;

  @ApiProperty({
    description: 'Customer bank account number to link for direct debit.',
    example: '0123456789',
  })
  @IsString()
  @MaxLength(20)
  accountNumber!: string;

  @ApiProperty({
    description: 'Resolved account name returned by bank lookup.',
    example: 'Test User',
  })
  @IsString()
  @MaxLength(120)
  accountName!: string;

  @ApiProperty({
    description:
      'Maximum amount that can be debited through this mandate, in minor units.',
    example: 5000000,
  })
  @IsInt()
  @Min(1)
  maximumAmount!: number;

  @ApiProperty({ description: 'Mandate currency.', example: 'NGN' })
  @IsISO4217CurrencyCode()
  currency!: string;
}

export class AuthorizeDirectDebitMandateDto {
  @ApiPropertyOptional({
    description:
      'Provider authorization reference returned when the mandate was created. If omitted, the saved mandate reference is used.',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;
}

export class FundWalletWithDirectDebitDto {
  @ApiProperty({
    description: 'Direct debit mandate UUID.',
    example: 'mandate-uuid',
  })
  @IsString()
  mandateUuid!: string;

  @ApiProperty({
    description: 'Funding amount in minor units.',
    example: 100000,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Funding currency.', example: 'NGN' })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiProperty({ description: 'User transaction PIN.', example: '1234' })
  @IsString()
  transactionPin!: string;
}

export class RevokeDirectDebitMandateDto {
  @ApiPropertyOptional({
    description: 'Reason for revoking the mandate.',
    example: 'User revoked mandate',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
