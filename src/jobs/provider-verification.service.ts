import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  PROVIDER_VERIFICATION_QUEUE,
  ProviderVerificationJobData,
} from './job-names';

@Injectable()
export class ProviderVerificationService {
  constructor(
    @InjectQueue(PROVIDER_VERIFICATION_QUEUE)
    private readonly queue: Queue<ProviderVerificationJobData>,
  ) {}

  async enqueueTransactionVerification(
    transactionReference: string,
    delayMs = 60_000,
  ): Promise<void> {
    await this.queue.add(
      'verify-provider-transaction',
      { transactionReference },
      {
        jobId: `provider-verify-${transactionReference}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        delay: delayMs,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
