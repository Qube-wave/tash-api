const TAG_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;
const RESERVED_TAGS = new Set([
  'admin',
  'api',
  'auth',
  'bank',
  'banks',
  'bvn',
  'card',
  'cards',
  'checkout',
  'health',
  'merchant',
  'merchants',
  'pay',
  'ping',
  'refund',
  'refunds',
  'settings',
  'support',
  'tash',
  'transaction',
  'transactions',
  'transfer',
  'transfers',
  'wallet',
  'wallets',
  'crypto',
  'web3',
  'solana',
  'ethereum',
  'eth',
  'base',
  'sui',
]);

export function normalizePaymentTag(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function isValidPaymentTag(value: string): boolean {
  const tag = normalizePaymentTag(value);
  return TAG_PATTERN.test(tag) && !RESERVED_TAGS.has(tag);
}

export function assertValidPaymentTag(value: string): string {
  const tag = normalizePaymentTag(value);

  if (!isValidPaymentTag(tag)) {
    throw new Error(
      'Payment tag must be 3-30 characters, start with a letter, and contain only letters, numbers, or underscores.',
    );
  }

  return tag;
}
