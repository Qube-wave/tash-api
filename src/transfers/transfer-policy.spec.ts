import {
  assertNotSelfTransfer,
  assertTransferCurrencyMatchesWallet,
} from './transfer-policy';

describe('transfer policy', () => {
  it('prevents self transfers', () => {
    expect(() => assertNotSelfTransfer(1, 1)).toThrow('Self transfer');
  });

  it('requires transfer currency to match wallet currency', () => {
    expect(() => assertTransferCurrencyMatchesWallet('USD', 'NGN')).toThrow(
      'Transfer currency',
    );
  });
});
