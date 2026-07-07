import { registerAs } from '@nestjs/config';

export type PaymentProviderName = 'mock' | 'nomba';

export interface PaymentProviderConfiguration {
  activeProvider: PaymentProviderName;
  nombaBaseUrl: string;
  nombaParentAccountId: string;
  nombaSubAccountId: string;
  nombaClientId: string;
  nombaPrivateKey: string;
  nombaCardTokenizationAmount: string;
}

export default registerAs(
  'paymentProvider',
  (): PaymentProviderConfiguration => ({
    activeProvider: (process.env.PAYMENT_PROVIDER ??
      'mock') as PaymentProviderName,
    nombaBaseUrl: process.env.NOMBA_BASE_URL ?? 'https://sandbox.nomba.com',
    nombaParentAccountId: process.env.NOMBA_PARENT_ACCOUNT_ID ?? '',
    nombaSubAccountId: process.env.NOMBA_SUB_ACCOUNT_ID ?? '',
    nombaClientId: process.env.NOMBA_CLIENT_ID ?? '',
    nombaPrivateKey: process.env.NOMBA_PRIVATE_KEY ?? '',
    nombaCardTokenizationAmount:
      process.env.NOMBA_CARD_TOKENIZATION_AMOUNT ?? '50.00',
  }),
);
