import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { TransactionStatus } from '../transactions/entities/transaction.entity';
import { canTransitionTransaction } from '../transactions/transaction-state-machine';
import { TransactionsService } from '../transactions/transactions.service';
import {
  PROVIDER_VERIFICATION_QUEUE,
  ProviderVerificationJobData,
} from './job-names';

@Processor(PROVIDER_VERIFICATION_QUEUE)
export class ProviderVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ProviderVerificationProcessor.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {
    super();
  }

  async process(job: Job<ProviderVerificationJobData>): Promise<void> {
    const transaction = await this.transactionsService.getEntityByReference(
      job.data.transactionReference,
    );

    if (
      transaction.status !== TransactionStatus.Pending &&
      transaction.status !== TransactionStatus.Processing &&
      transaction.status !== TransactionStatus.RequiresAction
    ) {
      return;
    }

    const providerReference =
      transaction.providerReference ?? transaction.reference;
    const providerTransaction = await this.providerFactory
      .getProvider()
      .verifyTransaction(providerReference);

    const nextStatus = this.mapProviderStatus(providerTransaction.status);
    if (nextStatus === null) {
      this.logger.debug(
        `Provider transaction ${providerReference} is still pending.`,
      );
      return;
    }

    if (!canTransitionTransaction(transaction.status, nextStatus)) {
      throw new Error(
        `Provider verification produced invalid transition: ${transaction.status} -> ${nextStatus}`,
      );
    }

    this.transactionsService.transition(transaction, nextStatus);

    transaction.provider = providerTransaction.provider;
    transaction.providerReference = providerTransaction.providerReference;
    await this.transactionsService.save(transaction);
  }

  private mapProviderStatus(
    status: 'pending' | 'successful' | 'failed' | 'reversed',
  ): TransactionStatus | null {
    switch (status) {
      case 'pending':
        return null;
      case 'successful':
        return TransactionStatus.Successful;
      case 'failed':
        return TransactionStatus.Failed;
      case 'reversed':
        return TransactionStatus.Reversed;
    }
  }
}
