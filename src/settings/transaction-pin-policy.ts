export interface TransactionPinLockPolicy {
  maxAttempts: number;
  lockMinutes: number;
}

export function calculateFailedPinState(
  currentFailedAttempts: number,
  policy: TransactionPinLockPolicy,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const failedAttempts = currentFailedAttempts + 1;

  if (failedAttempts < policy.maxAttempts) {
    return { failedAttempts, lockedUntil: null };
  }

  return {
    failedAttempts,
    lockedUntil: new Date(now.getTime() + policy.lockMinutes * 60 * 1000),
  };
}
