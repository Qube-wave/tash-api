import { assertValidPaymentTag, normalizePaymentTag } from './payment-tag.util';

describe('payment tag utilities', () => {
  it('normalizes tags for public use', () => {
    expect(normalizePaymentTag(' @Covenant_01 ')).toBe('covenant_01');
  });

  it('rejects invalid or reserved tags', () => {
    expect(() => assertValidPaymentTag('ta')).toThrow('Payment tag');
    expect(() => assertValidPaymentTag('wallet')).toThrow('Payment tag');
    expect(() => assertValidPaymentTag('1covenant')).toThrow('Payment tag');
  });
});
