import { Module } from '@nestjs/common';
import { PaymentProviderFactory } from './payment-provider.factory';
import { MockPaymentProvider } from './providers/mock-payment-provider';
import { NombaPaymentProvider } from './providers/nomba-payment-provider';

@Module({
  providers: [
    PaymentProviderFactory,
    MockPaymentProvider,
    NombaPaymentProvider,
  ],
  exports: [PaymentProviderFactory],
})
export class PaymentProvidersModule {}
