import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RefundDestinationType, RefundStatus } from '../entities/refund.entity';

export class CreateRefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(RefundDestinationType)
  destinationType!: RefundDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export interface RefundResponse {
  uuid: string;
  reference: string;
  transactionId: number;
  transactionMerchantId: number | null;
  amount: number;
  currency: string;
  destinationType: RefundDestinationType;
  destinationReference: string | null;
  reason: string | null;
  status: RefundStatus;
  failureReason: string | null;
  processedAt: Date | null;
  createdAt: Date;
}
