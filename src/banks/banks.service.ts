import { Injectable } from '@nestjs/common';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { ProviderBankAccount } from '../payment-providers/interfaces/payment-provider.interface';
import { ResolveAccountDto } from './dto/resolve-account.dto';

export interface BankResponse {
  name: string;
  code: string;
  country: string;
  currency: string;
}

const NIGERIAN_BANKS: readonly BankResponse[] = [
  { name: 'GTBank', code: '058', country: 'NG', currency: 'NGN' },
  { name: 'Access Bank', code: '044', country: 'NG', currency: 'NGN' },
  { name: 'Zenith Bank', code: '057', country: 'NG', currency: 'NGN' },
  {
    name: 'United Bank for Africa',
    code: '033',
    country: 'NG',
    currency: 'NGN',
  },
  {
    name: 'First Bank of Nigeria',
    code: '011',
    country: 'NG',
    currency: 'NGN',
  },
];

@Injectable()
export class BanksService {
  constructor(private readonly providerFactory: PaymentProviderFactory) {}

  listBanks(): BankResponse[] {
    return [...NIGERIAN_BANKS];
  }

  resolveAccount(dto: ResolveAccountDto): Promise<ProviderBankAccount> {
    return this.providerFactory.getProvider().resolveBankAccount(dto);
  }
}
