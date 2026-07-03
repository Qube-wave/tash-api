import { RefundStatus } from './entities/refund.entity';
import { TransactionStatus } from '../transactions/entities/transaction.entity';

export function assertRefundableTransaction(status: TransactionStatus): void {
  if (
    status !== TransactionStatus.Successful &&
    status !== TransactionStatus.PartiallyRefunded
  ) {
    throw new Error('Only successful transactions can be refunded.');
  }
}

export function assertRefundAmountAllowed(input: {
  originalAmount: number;
  existingRefundAmount: number;
  refundAmount: number;
}): void {
  if (input.refundAmount <= 0) {
    throw new Error('Refund amount must be greater than zero.');
  }

  if (input.existingRefundAmount + input.refundAmount > input.originalAmount) {
    throw new Error('Refund amount exceeds the remaining refundable amount.');
  }
}

export function isRefundAmountReserved(status: RefundStatus): boolean {
  return (
    status === RefundStatus.Pending ||
    status === RefundStatus.Processing ||
    status === RefundStatus.Successful
  );
}
