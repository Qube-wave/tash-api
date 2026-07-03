import { PayWithTashSessionStatus } from './entities/pay-with-tash-session.entity';

export function assertSessionCanBeAuthorized(
  status: PayWithTashSessionStatus,
  expiresAt: Date,
  now: Date,
): void {
  if (expiresAt <= now) {
    throw new Error('Pay with Tash session has expired.');
  }

  if (
    status !== PayWithTashSessionStatus.Created &&
    status !== PayWithTashSessionStatus.RequiresPaymentMethod
  ) {
    throw new Error('Pay with Tash session has already been processed.');
  }
}

export function assertRedirectUrlAllowed(
  redirectUrl: string | null,
  allowedRedirectUrls: string[],
): void {
  if (redirectUrl === null || allowedRedirectUrls.length === 0) {
    return;
  }

  const requested = new URL(redirectUrl);
  const allowed = allowedRedirectUrls.some((url) => {
    const parsed = new URL(url);
    return parsed.origin === requested.origin;
  });

  if (!allowed) {
    throw new Error('Redirect URL is not allowed for this merchant.');
  }
}
