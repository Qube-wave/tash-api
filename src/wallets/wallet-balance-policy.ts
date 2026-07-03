export interface WalletBalanceSnapshot {
  availableBalance: number;
  ledgerBalance: number;
}

export function assertDebitAllowed(
  wallet: WalletBalanceSnapshot,
  amount: number,
): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer in minor units.');
  }

  if (wallet.availableBalance < amount) {
    throw new Error('Insufficient wallet balance.');
  }
}

export function applyDebit(
  wallet: WalletBalanceSnapshot,
  amount: number,
): WalletBalanceSnapshot {
  assertDebitAllowed(wallet, amount);
  return {
    availableBalance: wallet.availableBalance - amount,
    ledgerBalance: wallet.ledgerBalance - amount,
  };
}

export function applyCredit(
  wallet: WalletBalanceSnapshot,
  amount: number,
): WalletBalanceSnapshot {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer in minor units.');
  }

  return {
    availableBalance: wallet.availableBalance + amount,
    ledgerBalance: wallet.ledgerBalance + amount,
  };
}
