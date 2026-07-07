import { CardStatus } from './entities/card.entity';
import { CardRegistrationSessionStatus } from './entities/card-registration-session.entity';

export function assertCardChargeable(status: CardStatus): void {
  if (status !== CardStatus.Active) {
    throw new Error('Card is not active.');
  }
}

export function assertCardRegistrationCanProceed(
  status: CardRegistrationSessionStatus,
  expiresAt: Date,
  now: Date,
): void {
  if (expiresAt <= now) {
    throw new Error('Card registration session has expired.');
  }

  if (
    status !== CardRegistrationSessionStatus.Created &&
    status !== CardRegistrationSessionStatus.Pending &&
    status !== CardRegistrationSessionStatus.Verified
  ) {
    throw new Error('Card registration session cannot be completed.');
  }
}

export function assertCardRegistrationCanFinalize(
  status: CardRegistrationSessionStatus,
  expiresAt: Date,
  now: Date,
): void {
  if (expiresAt <= now) {
    throw new Error('Card registration session has expired.');
  }

  if (status !== CardRegistrationSessionStatus.Verified) {
    throw new Error('Card registration session has not been verified.');
  }
}
