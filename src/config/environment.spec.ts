import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('uses safe local defaults', () => {
    const env = validateEnvironment({});

    expect(env.APP_NAME).toBe('tash-api');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_NAME).toBe('tash');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('skips external connections by default in tests', () => {
    const env = validateEnvironment({ NODE_ENV: 'test' });

    expect(env.SKIP_EXTERNAL_CONNECTIONS).toBe(true);
  });

  it('rejects invalid NODE_ENV values', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV must be one of',
    );
  });
});
