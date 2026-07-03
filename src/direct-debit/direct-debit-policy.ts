import { DirectDebitMandateStatus } from './entities/direct-debit-mandate.entity';

export function assertMandateChargeable(
  status: DirectDebitMandateStatus,
  expiresAt: Date | null,
  now: Date,
): void {
  if (status !== DirectDebitMandateStatus.Active) {
    throw new Error('Direct-debit mandate is not active.');
  }

  if (expiresAt !== null && expiresAt <= now) {
    throw new Error('Direct-debit mandate has expired.');
  }
}

export function assertMandateAmountAllowed(
  amount: number,
  maximumAmount: number,
): void {
  if (amount > maximumAmount) {
    throw new Error('Direct-debit amount exceeds mandate maximum amount.');
  }
}

export function normalizeAccountNumberLastFour(accountNumber: string): string {
  return accountNumber.slice(-4);
}
