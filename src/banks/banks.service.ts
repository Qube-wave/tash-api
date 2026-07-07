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

@Injectable()
export class BanksService {
  constructor(private readonly providerFactory: PaymentProviderFactory) {}

  async listBanks(): Promise<BankResponse[]> {
    const banks = await this.providerFactory.getProvider().listBanks();
    return banks.map((bank) => ({
      name: bank.name,
      code: bank.code,
      country: bank.country,
      currency: bank.currency,
    }));
  }

  resolveAccount(dto: ResolveAccountDto): Promise<ProviderBankAccount> {
    return this.providerFactory.getProvider().resolveBankAccount(dto);
  }
}
