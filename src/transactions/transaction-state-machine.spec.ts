import { TransactionStatus } from './entities/transaction.entity';
import {
  assertTransactionTransition,
  canTransitionTransaction,
} from './transaction-state-machine';

describe('transaction state machine', () => {
  it('allows configured forward transitions', () => {
    expect(
      canTransitionTransaction(
        TransactionStatus.Created,
        TransactionStatus.Processing,
      ),
    ).toBe(true);
    expect(
      canTransitionTransaction(
        TransactionStatus.Successful,
        TransactionStatus.PartiallyRefunded,
      ),
    ).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      assertTransactionTransition(
        TransactionStatus.Failed,
        TransactionStatus.Successful,
      ),
    ).toThrow('Invalid transaction state transition');
  });
});
