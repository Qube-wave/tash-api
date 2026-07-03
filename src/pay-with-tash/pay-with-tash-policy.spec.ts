import {
  assertRedirectUrlAllowed,
  assertSessionCanBeAuthorized,
} from './pay-with-tash-policy';
import { PayWithTashSessionStatus } from './entities/pay-with-tash-session.entity';

describe('Pay with Tash policy', () => {
  it('allows fresh created sessions to be authorized', () => {
    expect(() =>
      assertSessionCanBeAuthorized(
        PayWithTashSessionStatus.Created,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects successful sessions from being authorized again', () => {
    expect(() =>
      assertSessionCanBeAuthorized(
        PayWithTashSessionStatus.Successful,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('already been processed');
  });

  it('enforces merchant redirect allowlists by origin', () => {
    expect(() =>
      assertRedirectUrlAllowed('https://merchant.example.com/done', [
        'https://merchant.example.com/callback',
      ]),
    ).not.toThrow();
    expect(() =>
      assertRedirectUrlAllowed('https://evil.example.com/done', [
        'https://merchant.example.com/callback',
      ]),
    ).toThrow('not allowed');
  });
});
