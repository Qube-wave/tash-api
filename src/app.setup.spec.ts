import { isCorsOriginAllowed } from './app.setup';

describe('isCorsOriginAllowed', () => {
  it('allows requests without an origin header', () => {
    expect(
      isCorsOriginAllowed(undefined, {
        nodeEnv: 'production',
        corsOrigins: [],
      }),
    ).toBe(true);
  });

  it('allows origins in the configured allowlist', () => {
    expect(
      isCorsOriginAllowed('https://app.tash.com', {
        nodeEnv: 'production',
        corsOrigins: ['https://app.tash.com'],
      }),
    ).toBe(true);
  });

  it('allows local development origins when no allowlist is configured', () => {
    expect(
      isCorsOriginAllowed('http://localhost:3000', {
        nodeEnv: 'development',
        corsOrigins: [],
      }),
    ).toBe(true);
  });

  it('rejects unconfigured origins when an allowlist is configured', () => {
    expect(
      isCorsOriginAllowed('https://evil.example', {
        nodeEnv: 'development',
        corsOrigins: ['http://localhost:5173'],
      }),
    ).toBe(false);
  });

  it('rejects unconfigured production origins when no allowlist is configured', () => {
    expect(
      isCorsOriginAllowed('https://app.tash.com', {
        nodeEnv: 'production',
        corsOrigins: [],
      }),
    ).toBe(false);
  });
});
