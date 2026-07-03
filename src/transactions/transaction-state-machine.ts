import { TransactionStatus } from './entities/transaction.entity';

const allowedTransitions: ReadonlyMap<
  TransactionStatus,
  readonly TransactionStatus[]
> = new Map([
  [
    TransactionStatus.Created,
    [
      TransactionStatus.Pending,
      TransactionStatus.RequiresAction,
      TransactionStatus.Processing,
      TransactionStatus.Failed,
    ],
  ],
  [
    TransactionStatus.Pending,
    [
      TransactionStatus.RequiresAction,
      TransactionStatus.Processing,
      TransactionStatus.Successful,
      TransactionStatus.Failed,
      TransactionStatus.Cancelled,
    ],
  ],
  [
    TransactionStatus.RequiresAction,
    [
      TransactionStatus.Processing,
      TransactionStatus.Successful,
      TransactionStatus.Failed,
      TransactionStatus.Cancelled,
    ],
  ],
  [
    TransactionStatus.Processing,
    [
      TransactionStatus.Successful,
      TransactionStatus.Failed,
      TransactionStatus.Reversed,
    ],
  ],
  [
    TransactionStatus.Successful,
    [
      TransactionStatus.PartiallyRefunded,
      TransactionStatus.Refunded,
      TransactionStatus.Reversed,
    ],
  ],
  [TransactionStatus.PartiallyRefunded, [TransactionStatus.Refunded]],
]);

export function canTransitionTransaction(
  current: TransactionStatus,
  next: TransactionStatus,
): boolean {
  if (current === next) {
    return true;
  }

  return allowedTransitions.get(current)?.includes(next) ?? false;
}

export function assertTransactionTransition(
  current: TransactionStatus,
  next: TransactionStatus,
): void {
  if (!canTransitionTransaction(current, next)) {
    throw new Error(
      `Invalid transaction state transition: ${current} -> ${next}`,
    );
  }
}
