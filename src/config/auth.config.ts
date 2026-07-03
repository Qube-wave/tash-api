import { registerAs } from '@nestjs/config';

export interface AuthConfiguration {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  verificationTokenTtlSeconds: number;
  passwordResetTokenTtlSeconds: number;
}

export default registerAs('auth', (): AuthConfiguration => ({
  accessTokenSecret:
    process.env.JWT_ACCESS_TOKEN_SECRET ?? 'change-me-access-secret',
  refreshTokenSecret:
    process.env.JWT_REFRESH_TOKEN_SECRET ?? 'change-me-refresh-secret',
  accessTokenTtlSeconds: Number(
    process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60,
  ),
  refreshTokenTtlSeconds: Number(
    process.env.JWT_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60,
  ),
  verificationTokenTtlSeconds: Number(
    process.env.VERIFICATION_TOKEN_TTL_SECONDS ?? 24 * 60 * 60,
  ),
  passwordResetTokenTtlSeconds: Number(
    process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS ?? 30 * 60,
  ),
}));
