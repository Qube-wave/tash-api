import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBankTransferDto {
  @IsUUID()
  walletUuid!: string;

  @IsString()
  @MaxLength(20)
  bankCode!: string;

  @IsString()
  @Length(10, 10)
  accountNumber!: string;

  @IsString()
  @MaxLength(120)
  accountName!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsString()
  transactionPin!: string;
}
