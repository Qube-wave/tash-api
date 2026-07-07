import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProviderConfiguration,
  PaymentProviderName,
} from '../config/payment-provider.config';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment-provider';
import { NombaPaymentProvider } from './providers/nomba-payment-provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly nombaProvider: NombaPaymentProvider,
  ) {}

  getProvider(): PaymentProvider {
    const config =
      this.configService.getOrThrow<PaymentProviderConfiguration>(
        'paymentProvider',
      );

    return this.getProviderByName(config.activeProvider);
  }

  getProviderByName(provider: PaymentProviderName): PaymentProvider {
    switch (provider) {
      case 'mock':
        return this.mockProvider;
      case 'nomba':
        return this.nombaProvider;
    }
  }
}
