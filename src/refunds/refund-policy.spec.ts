import {
  assertRefundAmountAllowed,
  assertRefundableTransaction,
  isRefundAmountReserved,
} from './refund-policy';
import { RefundStatus } from './entities/refund.entity';
import { TransactionStatus } from '../transactions/entities/transaction.entity';

describe('refund policy', () => {
  it('allows successful and partially refunded transactions', () => {
    expect(() =>
      assertRefundableTransaction(TransactionStatus.Successful),
    ).not.toThrow();
    expect(() =>
      assertRefundableTransaction(TransactionStatus.PartiallyRefunded),
    ).not.toThrow();
  });

  it('rejects non-refundable transaction states', () => {
    expect(() => assertRefundableTransaction(TransactionStatus.Failed)).toThrow(
      'Only successful transactions can be refunded.',
    );
  });

  it('prevents zero-value refunds', () => {
    expect(() =>
      assertRefundAmountAllowed({
        originalAmount: 1000,
        existingRefundAmount: 0,
        refundAmount: 0,
      }),
    ).toThrow('Refund amount must be greater than zero.');
  });

  it('prevents cumulative refunds above the original amount', () => {
    expect(() =>
      assertRefundAmountAllowed({
        originalAmount: 1000,
        existingRefundAmount: 800,
        refundAmount: 201,
      }),
    ).toThrow('Refund amount exceeds the remaining refundable amount.');
  });

  it('reserves pending, processing, and successful refund amounts', () => {
    expect(isRefundAmountReserved(RefundStatus.Pending)).toBe(true);
    expect(isRefundAmountReserved(RefundStatus.Processing)).toBe(true);
    expect(isRefundAmountReserved(RefundStatus.Successful)).toBe(true);
    expect(isRefundAmountReserved(RefundStatus.Failed)).toBe(false);
  });
});
