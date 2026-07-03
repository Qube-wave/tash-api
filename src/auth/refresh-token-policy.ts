export interface RefreshTokenState {
  expiresAt: Date;
  revokedAt: Date | null;
}

export function isRefreshTokenUsable(
  token: RefreshTokenState,
  now: Date,
): boolean {
  return token.revokedAt === null && token.expiresAt > now;
}
