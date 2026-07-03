import { assertVirtualAccountCanReceiveFunding } from './virtual-account-policy';
import {
  VirtualAccountPurpose,
  VirtualAccountStatus,
} from './entities/virtual-account.entity';

describe('virtual account policy', () => {
  it('allows active wallet-funding accounts', () => {
    expect(() =>
      assertVirtualAccountCanReceiveFunding(
        VirtualAccountStatus.Active,
        VirtualAccountPurpose.WalletFunding,
        null,
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects disabled accounts', () => {
    expect(() =>
      assertVirtualAccountCanReceiveFunding(
        VirtualAccountStatus.Disabled,
        VirtualAccountPurpose.WalletFunding,
        null,
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('not active');
  });

  it('rejects non-funding purposes', () => {
    expect(() =>
      assertVirtualAccountCanReceiveFunding(
        VirtualAccountStatus.Active,
        VirtualAccountPurpose.Refund,
        null,
        new Date('2026-07-03T10:00:00.000Z'),
      ),
    ).toThrow('wallet funding');
  });
});
