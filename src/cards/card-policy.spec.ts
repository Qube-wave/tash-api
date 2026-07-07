import {
  assertCardChargeable,
  assertCardRegistrationCanFinalize,
  assertCardRegistrationCanProceed,
} from './card-policy';
import { CardRegistrationSessionStatus } from './entities/card-registration-session.entity';
import { CardStatus } from './entities/card.entity';

describe('card policy', () => {
  it('allows active cards to be charged', () => {
    expect(() => assertCardChargeable(CardStatus.Active)).not.toThrow();
  });

  it('rejects inactive cards for charges', () => {
    expect(() => assertCardChargeable(CardStatus.Disabled)).toThrow(
      'Card is not active',
    );
  });

  it('allows fresh created registration sessions to complete', () => {
    expect(() =>
      assertCardRegistrationCanProceed(
        CardRegistrationSessionStatus.Created,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('allows verified registration sessions to finalize', () => {
    expect(() =>
      assertCardRegistrationCanFinalize(
        CardRegistrationSessionStatus.Verified,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects unverified registration sessions during finalization', () => {
    expect(() =>
      assertCardRegistrationCanFinalize(
        CardRegistrationSessionStatus.Created,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('not been verified');
  });

  it('rejects completed registration sessions during provider steps', () => {
    expect(() =>
      assertCardRegistrationCanProceed(
        CardRegistrationSessionStatus.Completed,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('cannot proceed from completed');
  });

  it('rejects failed registration sessions during provider steps', () => {
    expect(() =>
      assertCardRegistrationCanProceed(
        CardRegistrationSessionStatus.Failed,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('cannot proceed from failed');
  });

  it('rejects expired registration sessions', () => {
    expect(() =>
      assertCardRegistrationCanProceed(
        CardRegistrationSessionStatus.Created,
        new Date('2026-07-03T10:00:00.000Z'),
        new Date('2026-07-03T10:00:01.000Z'),
      ),
    ).toThrow('expired');
  });
});
