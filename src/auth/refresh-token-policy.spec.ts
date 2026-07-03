import { isRefreshTokenUsable } from './refresh-token-policy';

describe('refresh token policy', () => {
  const now = new Date('2026-07-03T10:00:00.000Z');

  it('accepts unrevoked tokens that have not expired', () => {
    expect(
      isRefreshTokenUsable(
        { revokedAt: null, expiresAt: new Date('2026-07-03T10:01:00.000Z') },
        now,
      ),
    ).toBe(true);
  });

  it('rejects revoked tokens', () => {
    expect(
      isRefreshTokenUsable(
        {
          revokedAt: new Date('2026-07-03T09:59:00.000Z'),
          expiresAt: new Date('2026-07-03T10:01:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('rejects expired tokens', () => {
    expect(
      isRefreshTokenUsable(
        { revokedAt: null, expiresAt: new Date('2026-07-03T09:59:00.000Z') },
        now,
      ),
    ).toBe(false);
  });
});
