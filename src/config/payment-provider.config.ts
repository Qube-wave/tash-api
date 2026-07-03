import { registerAs } from '@nestjs/config';

export type PaymentProviderName = 'mock' | 'nomba';

export interface PaymentProviderConfiguration {
  activeProvider: PaymentProviderName;
}

export default registerAs(
  'paymentProvider',
  (): PaymentProviderConfiguration => ({
    activeProvider: (process.env.PAYMENT_PROVIDER ??
      'mock') as PaymentProviderName,
  }),
);
