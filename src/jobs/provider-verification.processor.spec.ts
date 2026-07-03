import { Job } from 'bullmq';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import {
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { ProviderVerificationJobData } from './job-names';
import { ProviderVerificationProcessor } from './provider-verification.processor';

describe('ProviderVerificationProcessor', () => {
  it('applies successful provider verification through the transaction state machine', async () => {
    const transaction = {
      reference: 'txn_test',
      providerReference: 'provider_ref',
      status: TransactionStatus.Processing,
      type: TransactionType.CardCharge,
      direction: TransactionDirection.Debit,
    } as Transaction;
    const transactionsService = {
      getEntityByReference: jest
        .fn<Promise<Transaction>, [string]>()
        .mockResolvedValue(transaction),
      transition: jest.fn((entity: Transaction, status: TransactionStatus) => {
        entity.status = status;
        return entity;
      }),
      save: jest
        .fn<Promise<Transaction>, [Transaction]>()
        .mockResolvedValue(transaction),
    };
    const providerFactory = {
      getProvider: () => ({
        verifyTransaction: jest.fn().mockResolvedValue({
          provider: 'mock',
          providerReference: 'provider_ref_verified',
          status: 'successful',
          metadata: {},
        }),
      }),
    };
    const processor = new ProviderVerificationProcessor(
      transactionsService as unknown as TransactionsService,
      providerFactory as unknown as PaymentProviderFactory,
    );

    await processor.process({
      data: { transactionReference: 'txn_test' },
    } as Job<ProviderVerificationJobData>);

    expect(transactionsService.transition).toHaveBeenCalledWith(
      transaction,
      TransactionStatus.Successful,
    );
    expect(transaction.providerReference).toBe('provider_ref_verified');
    expect(transactionsService.save).toHaveBeenCalledWith(transaction);
  });
});
