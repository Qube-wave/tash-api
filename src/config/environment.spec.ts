import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('uses safe local defaults', () => {
    const env = validateEnvironment({});

    expect(env.APP_NAME).toBe('tash-api');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_NAME).toBe('tash');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.TERMII_API_KEY).toBe('');
    expect(env.TERMII_BASE_URL).toBe('https://api.ng.termii.com');
    expect(env.SENDCHAMP_API_KEY).toBe('');
    expect(env.SENDCHAMP_BASE_URL).toBe('https://api.sendchamp.com/api/v1');
    expect(env.AFRICAS_TALKING_API_KEY).toBe('');
    expect(env.AFRICAS_TALKING_BASE_URL).toBe('https://api.africastalking.com');
    expect(env.AFRICAS_TALKING_SENDER_ID).toBe('');
    expect(env.AFRICAS_TALKING_USERNAME).toBe('');
  });

  it('skips external connections by default in tests', () => {
    const env = validateEnvironment({ NODE_ENV: 'test' });

    expect(env.SKIP_EXTERNAL_CONNECTIONS).toBe(true);
  });

  it('requires a Termii API key in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
      }),
    ).toThrow('TERMII_API_KEY must be configured for production');
  });

  it('requires a Sendchamp API key in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
        TERMII_API_KEY: 'production-termii-key',
      }),
    ).toThrow('SENDCHAMP_API_KEY must be configured for production');
  });

  it("requires an Africa's Talking API key in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
        TERMII_API_KEY: 'production-termii-key',
        SENDCHAMP_API_KEY: 'production-sendchamp-key',
      }),
    ).toThrow('AFRICAS_TALKING_API_KEY must be configured for production');
  });

  it("requires an Africa's Talking username in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
        TERMII_API_KEY: 'production-termii-key',
        SENDCHAMP_API_KEY: 'production-sendchamp-key',
        AFRICAS_TALKING_API_KEY: 'production-africas-talking-key',
      }),
    ).toThrow('AFRICAS_TALKING_USERNAME must be configured for production');
  });

  it('rejects invalid Termii base URLs', () => {
    expect(() => validateEnvironment({ TERMII_BASE_URL: 'not-a-url' })).toThrow(
      'TERMII_BASE_URL must be a valid URL',
    );
  });

  it('rejects invalid Sendchamp base URLs', () => {
    expect(() =>
      validateEnvironment({ SENDCHAMP_BASE_URL: 'not-a-url' }),
    ).toThrow('SENDCHAMP_BASE_URL must be a valid URL');
  });

  it("rejects invalid Africa's Talking base URLs", () => {
    expect(() =>
      validateEnvironment({ AFRICAS_TALKING_BASE_URL: 'not-a-url' }),
    ).toThrow('AFRICAS_TALKING_BASE_URL must be a valid URL');
  });

  it('rejects invalid NODE_ENV values', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV must be one of',
    );
  });
});
