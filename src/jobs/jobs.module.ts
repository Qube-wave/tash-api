import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PROVIDER_VERIFICATION_QUEUE } from './job-names';
import { ProviderVerificationProcessor } from './provider-verification.processor';
import { ProviderVerificationService } from './provider-verification.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: PROVIDER_VERIFICATION_QUEUE }),
    PaymentProvidersModule,
    TransactionsModule,
  ],
  providers: [ProviderVerificationProcessor, ProviderVerificationService],
  exports: [ProviderVerificationService],
})
export class JobsModule {}
