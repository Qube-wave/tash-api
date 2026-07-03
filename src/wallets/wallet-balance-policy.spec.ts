import {
  applyCredit,
  applyDebit,
  assertDebitAllowed,
} from './wallet-balance-policy';

describe('wallet balance policy', () => {
  it('prevents negative available balances', () => {
    expect(() =>
      assertDebitAllowed({ availableBalance: 100, ledgerBalance: 100 }, 101),
    ).toThrow('Insufficient wallet balance');
  });

  it('applies debits in integer minor units', () => {
    expect(
      applyDebit({ availableBalance: 1000, ledgerBalance: 1000 }, 250),
    ).toEqual({
      availableBalance: 750,
      ledgerBalance: 750,
    });
  });

  it('applies credits in integer minor units', () => {
    expect(
      applyCredit({ availableBalance: 1000, ledgerBalance: 1000 }, 250),
    ).toEqual({
      availableBalance: 1250,
      ledgerBalance: 1250,
    });
  });
});
