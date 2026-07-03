import {
  IsDateString,
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class ListTransactionsQuery {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionDirection)
  direction?: TransactionDirection;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maximumAmount?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
