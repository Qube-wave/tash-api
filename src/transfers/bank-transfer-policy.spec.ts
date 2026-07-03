import { assertBankTransferAccountNameMatches } from './bank-transfer-policy';

describe('bank transfer policy', () => {
  it('allows exact normalized account-name matches', () => {
    expect(() =>
      assertBankTransferAccountNameMatches(' Mock Account ', 'mock account'),
    ).not.toThrow();
  });

  it('rejects mismatched account names', () => {
    expect(() =>
      assertBankTransferAccountNameMatches('Ada User', 'Different User'),
    ).toThrow('does not match');
  });
});
