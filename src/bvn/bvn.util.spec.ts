import { determineBvnStatus, maskBvn, namesMatch } from './bvn.util';

describe('BVN utilities', () => {
  it('masks BVNs without returning the full value', () => {
    expect(maskBvn('12345678901')).toBe('123*****901');
  });

  it('compares names case-insensitively', () => {
    expect(namesMatch(' Covenant ', 'covenant')).toBe(true);
  });

  it('keeps provider failed state as failed', () => {
    expect(
      determineBvnStatus(
        {
          firstName: 'Covenant',
          lastName: 'Example',
          dateOfBirth: '2000-01-01',
        },
        { verificationStatus: 'failed' },
      ),
    ).toBe('failed');
  });

  it('rejects verified provider responses when identity details mismatch', () => {
    expect(
      determineBvnStatus(
        {
          firstName: 'Covenant',
          lastName: 'Example',
          dateOfBirth: '2000-01-01',
        },
        {
          verificationStatus: 'verified',
          verifiedFirstName: 'Different',
          verifiedLastName: 'Example',
          verifiedDateOfBirth: '2000-01-01',
        },
      ),
    ).toBe('rejected');
  });
});
