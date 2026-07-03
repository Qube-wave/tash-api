import { WalletStatus } from '../entities/wallet.entity';

export interface WalletResponse {
  walletUuid: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  ledgerBalance: number;
  status: WalletStatus;
}
