import {
  IsISO4217CurrencyCode,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTashTransferDto {
  @IsString()
  @MaxLength(255)
  recipient!: string;

  @IsUUID()
  walletUuid!: string;

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
