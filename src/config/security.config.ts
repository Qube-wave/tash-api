import { registerAs } from '@nestjs/config';

export interface SecurityConfiguration {
  bvnEncryptionKey: string;
  transactionPinMaxAttempts: number;
  transactionPinLockMinutes: number;
}

export default registerAs('security', (): SecurityConfiguration => ({
  bvnEncryptionKey:
    process.env.BVN_ENCRYPTION_KEY ?? 'local-development-bvn-key-change-me',
  transactionPinMaxAttempts: Number(
    process.env.TRANSACTION_PIN_MAX_ATTEMPTS ?? 5,
  ),
  transactionPinLockMinutes: Number(
    process.env.TRANSACTION_PIN_LOCK_MINUTES ?? 15,
  ),
}));
