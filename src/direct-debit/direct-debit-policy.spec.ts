import {
  assertMandateAmountAllowed,
  assertMandateChargeable,
  normalizeAccountNumberLastFour,
} from './direct-debit-policy';
import { DirectDebitMandateStatus } from './entities/direct-debit-mandate.entity';

describe('direct debit policy', () => {
  it('allows active non-expired mandates to be charged', () => {
    expect(() =>
      assertMandateChargeable(
        DirectDebitMandateStatus.Active,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects inactive mandates', () => {
    expect(() =>
      assertMandateChargeable(
        DirectDebitMandateStatus.Revoked,
        null,
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('not active');
  });

  it('rejects amounts above the mandate maximum', () => {
    expect(() => assertMandateAmountAllowed(200, 100)).toThrow('maximum');
  });

  it('stores only account number last four digits', () => {
    expect(normalizeAccountNumberLastFour('0123456789')).toBe('6789');
  });
});
