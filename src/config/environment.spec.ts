import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('uses safe local defaults', () => {
    const env = validateEnvironment({});

    expect(env.BASE_URL).toBe('http://localhost:3000');
    expect(env.APP_NAME).toBe('tash-api');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_NAME).toBe('tash');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.RESEND_API_KEY).toBe('');
    expect(env.RESEND_FROM_EMAIL).toBe('');
    expect(env.AFRICAS_TALKING_API_KEY).toBe('');
    expect(env.AFRICAS_TALKING_BASE_URL).toBe('https://api.africastalking.com');
    expect(env.AFRICAS_TALKING_SENDER_ID).toBe('');
    expect(env.AFRICAS_TALKING_USERNAME).toBe('');
  });

  it('skips external connections by default in tests', () => {
    const env = validateEnvironment({ NODE_ENV: 'test' });

    expect(env.SKIP_EXTERNAL_CONNECTIONS).toBe(true);
  });

  it('requires a Resend API key in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
      }),
    ).toThrow('RESEND_API_KEY must be configured for production');
  });

  it("requires an Africa's Talking API key in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-access-secret',
        JWT_REFRESH_TOKEN_SECRET: 'production-refresh-secret',
        BVN_ENCRYPTION_KEY: 'production-bvn-secret',
        RESEND_API_KEY: 'production-resend-key',
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
        RESEND_API_KEY: 'production-resend-key',
        AFRICAS_TALKING_API_KEY: 'production-africas-talking-key',
      }),
    ).toThrow('AFRICAS_TALKING_USERNAME must be configured for production');
  });

  it('rejects invalid base URLs', () => {
    expect(() => validateEnvironment({ BASE_URL: 'not-a-url' })).toThrow(
      'BASE_URL must be a valid URL',
    );
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
