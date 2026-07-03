import { CardStatus } from './entities/card.entity';
import { assertCardChargeable } from './card-policy';

describe('card funding policy', () => {
  it('requires an active card before wallet funding', () => {
    expect(() => assertCardChargeable(CardStatus.Active)).not.toThrow();
    expect(() => assertCardChargeable(CardStatus.Revoked)).toThrow(
      'Card is not active',
    );
  });
});
