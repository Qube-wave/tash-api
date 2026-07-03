import {
  assertCardChargeable,
  assertCardRegistrationCanComplete,
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
      assertCardRegistrationCanComplete(
        CardRegistrationSessionStatus.Created,
        new Date('2026-07-03T10:10:00.000Z'),
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects expired registration sessions', () => {
    expect(() =>
      assertCardRegistrationCanComplete(
        CardRegistrationSessionStatus.Created,
        new Date('2026-07-03T10:00:00.000Z'),
        new Date('2026-07-03T10:00:01.000Z'),
      ),
    ).toThrow('expired');
  });
});
