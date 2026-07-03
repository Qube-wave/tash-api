import {
  VirtualAccountPurpose,
  VirtualAccountStatus,
} from './entities/virtual-account.entity';

export function assertVirtualAccountCanReceiveFunding(
  status: VirtualAccountStatus,
  purpose: VirtualAccountPurpose,
  expiresAt: Date | null,
  now: Date,
): void {
  if (status !== VirtualAccountStatus.Active) {
    throw new Error('Virtual account is not active.');
  }

  if (purpose !== VirtualAccountPurpose.WalletFunding) {
    throw new Error('Virtual account is not configured for wallet funding.');
  }

  if (expiresAt !== null && expiresAt <= now) {
    throw new Error('Virtual account has expired.');
  }
}
