import { hashIdempotencyRequest } from './idempotency.util';

describe('hashIdempotencyRequest', () => {
  it('creates stable hashes regardless of object key order', () => {
    expect(hashIdempotencyRequest({ amount: 100, currency: 'NGN' })).toBe(
      hashIdempotencyRequest({ currency: 'NGN', amount: 100 }),
    );
  });

  it('creates different hashes for different requests', () => {
    expect(hashIdempotencyRequest({ amount: 100 })).not.toBe(
      hashIdempotencyRequest({ amount: 101 }),
    );
  });
});
