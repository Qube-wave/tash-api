import { ApiProperty, ApiPropertyOptional } from '/swagger';
import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDirectDebitMandateDto {
  ({
    description: 'Recipient bank code selected from the banks endpoint.',
    example: '058',
  })
  ()
  @MaxLength(20)
  bankCode!: string;

  ({
    description: 'Customer bank account number to link for direct debit.',
    example: '0123456789',
  })
  ()
  (20)
  accountNumber!: string;

  ({
    description: 'Resolved account name returned by bank lookup.',
    example: 'Test User',
  })
  ()
  (120)
  accountName!: string;

  ({
    description: 'Maximum amount that can be debited through this mandate, in minor units.',
    example: 5000000,
  })
  ()
  (1)
  maximumAmount!: number;

  ({ description: 'Mandate currency.', example: 'NGN' })
  ()
  currency!: string;
}

export class AuthorizeDirectDebitMandateDto {
  ({
    description: 'Provider authorization reference returned when the mandate was created.',
    example: '1234567890',
  })
  ()
  @MaxLength(120)
  authorizationReference!: string;
}

export class FundWalletWithDirectDebitDto {
  ({ description: 'Direct debit mandate UUID.', example: 'mandate-uuid' })
  ()
  mandateUuid!: string;

  ({
    description: 'Funding amount in minor units.',
    example: 100000,
  })
  ()
  (1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  ({ description: 'User transaction PIN.', example: '1234' })
  ()
  transactionPin!: string;
}

export class RevokeDirectDebitMandateDto {
  ({
    description: 'Reason for revoking the mandate.',
    example: 'User revoked mandate',
  })
  ()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
