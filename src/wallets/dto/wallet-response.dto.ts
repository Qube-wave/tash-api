import {
  LedgerDirection,
  WalletLedgerEntryStatus,
  WalletLedgerEntryType,
} from '../entities/wallet-ledger-entry.entity';
import { WalletStatus } from '../entities/wallet.entity';

export interface WalletResponse {
  walletUuid: string;
  currency: string;
  availableBalance: number;
  ledgerBalance: number;
  status: WalletStatus;
}

export interface WalletLedgerEntryResponse {
  uuid: string;
  reference: string;
  direction: LedgerDirection;
  entryType: WalletLedgerEntryType;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  status: WalletLedgerEntryStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
