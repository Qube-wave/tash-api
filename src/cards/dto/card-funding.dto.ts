import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO4217CurrencyCode,
  IsInt,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class FundWalletWithCardDto {
  @ApiProperty({
    description: 'UUID of the saved card to charge.',
    example: '8df1199a-6b63-4f05-9b7c-2cfe87cfb123',
  })
  @IsUUID()
  cardUuid!: string;

  @ApiProperty({
    description: 'Amount to fund in the smallest supported wallet unit.',
    example: 5000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({
    description: 'Currency to charge and fund.',
    example: 'NGN',
  })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiProperty({
    description: 'User transaction PIN used to authorize the funding request.',
    example: '1234',
  })
  @IsString()
  transactionPin!: string;
}
