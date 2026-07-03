import {
  IsISO4217CurrencyCode,
  IsInt,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class FundWalletWithCardDto {
  @IsUUID()
  cardUuid!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsString()
  transactionPin!: string;
}
