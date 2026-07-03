import { calculateFailedPinState } from './transaction-pin-policy';

describe('transaction PIN lock policy', () => {
  it('increments failed attempts before the lock threshold', () => {
    const state = calculateFailedPinState(
      2,
      { maxAttempts: 5, lockMinutes: 15 },
      new Date('2026-07-03T10:00:00.000Z'),
    );

    expect(state.failedAttempts).toBe(3);
    expect(state.lockedUntil).toBeNull();
  });

  it('locks the PIN when the threshold is reached', () => {
    const state = calculateFailedPinState(
      4,
      { maxAttempts: 5, lockMinutes: 15 },
      new Date('2026-07-03T10:00:00.000Z'),
    );

    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil?.toISOString()).toBe('2026-07-03T10:15:00.000Z');
  });
});
