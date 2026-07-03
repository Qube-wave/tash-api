import { selectRateLimitRule } from './rate-limit-policy';

describe('selectRateLimitRule', () => {
  it('uses a tight bucket for authentication writes', () => {
    expect(selectRateLimitRule('POST', '/api/v1/auth/login')).toMatchObject({
      bucket: 'auth',
      limit: 8,
    });
  });

  it('uses a payment write bucket for financial writes', () => {
    expect(selectRateLimitRule('POST', '/api/v1/transfers/tash')).toMatchObject(
      { bucket: 'payment-write', limit: 30 },
    );
  });

  it('uses the merchant API bucket for merchant endpoints', () => {
    expect(
      selectRateLimitRule('GET', '/api/v1/merchants/me/refunds'),
    ).toMatchObject({ bucket: 'merchant-api', limit: 120 });
  });
});
