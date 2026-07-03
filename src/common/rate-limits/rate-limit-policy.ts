export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowMs: number;
}

export function selectRateLimitRule(
  method: string,
  path: string,
): RateLimitRule {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.toLowerCase();

  if (
    normalizedMethod === 'POST' &&
    (normalizedPath.includes('/auth/login') ||
      normalizedPath.includes('/auth/register') ||
      normalizedPath.includes('/auth/forgot-password') ||
      normalizedPath.includes('/auth/reset-password'))
  ) {
    return { bucket: 'auth', limit: 8, windowMs: 60_000 };
  }

  if (
    normalizedMethod !== 'GET' &&
    (normalizedPath.includes('/wallets/') ||
      normalizedPath.includes('/transfers/') ||
      normalizedPath.includes('/pay-with-tash/') ||
      normalizedPath.includes('/refunds') ||
      normalizedPath.includes('/virtual-accounts') ||
      normalizedPath.includes('/direct-debit/') ||
      normalizedPath.includes('/cards/'))
  ) {
    return { bucket: 'payment-write', limit: 30, windowMs: 60_000 };
  }

  if (normalizedPath.includes('/merchants/me')) {
    return { bucket: 'merchant-api', limit: 120, windowMs: 60_000 };
  }

  return { bucket: 'general', limit: 300, windowMs: 60_000 };
}
