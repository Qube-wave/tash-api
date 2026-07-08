import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransferFundingSource } from './transfer-funding-source.enum';

export class CreateBankTransferDto {
  @ApiProperty({
    description: 'UUID of the wallet used for the transfer or source funding.',
    example: '2b096814-1258-473a-9d88-9ef26694465f',
  })
  @IsUUID()
  walletUuid!: string;

  @ApiProperty({ description: 'Recipient bank code.', example: '058' })
  @IsString()
  @MaxLength(20)
  bankCode!: string;

  @ApiProperty({
    description: 'Recipient 10-digit account number.',
    example: '0554728140',
  })
  @IsString()
  @Length(10, 10)
  accountNumber!: string;

  @ApiProperty({
    description: 'Recipient account name supplied by the app.',
    example: 'Test User',
  })
  @IsString()
  @MaxLength(120)
  accountName!: string;

  @ApiProperty({
    description: 'Amount in the smallest supported wallet unit.',
    example: 5000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Transfer currency.', example: 'NGN' })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiPropertyOptional({
    description: 'Optional transfer narration.',
    example: 'Rent support',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ description: 'User transaction PIN.', example: '1234' })
  @IsString()
  transactionPin!: string;

  @ApiPropertyOptional({
    enum: TransferFundingSource,
    default: TransferFundingSource.Wallet,
    description:
      'Funding source for the transfer. Card and direct debit first fund the wallet, then execute the transfer. Virtual account funding is asynchronous and cannot be pulled directly.',
  })
  @IsOptional()
  @IsEnum(TransferFundingSource)
  fundingSource?: TransferFundingSource;

  @ApiPropertyOptional({
    description: 'Required when fundingSource is card.',
    example: '8df1199a-6b63-4f05-9b7c-2cfe87cfb123',
  })
  @ValidateIf(
    (dto: CreateBankTransferDto) =>
      dto.fundingSource === TransferFundingSource.Card,
  )
  @IsUUID()
  cardUuid?: string;

  @ApiPropertyOptional({
    description: 'Required when fundingSource is direct_debit.',
    example: '00450470-e384-4ad6-a7b4-cf5ce055e021',
  })
  @ValidateIf(
    (dto: CreateBankTransferDto) =>
      dto.fundingSource === TransferFundingSource.DirectDebit,
  )
  @IsUUID()
  mandateUuid?: string;
}
