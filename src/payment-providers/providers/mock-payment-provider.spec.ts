import { MockPaymentProvider } from './mock-payment-provider';

describe('MockPaymentProvider', () => {
  it('normalizes successful BVN verification responses', async () => {
    const result = await new MockPaymentProvider().verifyBvn({
      bvn: '22222222222',
      firstName: 'Covenant',
      lastName: 'Example',
      dateOfBirth: '2000-01-01',
      phoneNumber: '+2348000000000',
    });

    expect(result).toMatchObject({
      provider: 'mock',
      verificationStatus: 'verified',
      verifiedFirstName: 'Covenant',
      verifiedLastName: 'Example',
      verifiedDateOfBirth: '2000-01-01',
    });
  });

  it('normalizes failed BVN verification responses', async () => {
    const result = await new MockPaymentProvider().verifyBvn({
      bvn: '22222222000',
      firstName: 'Covenant',
      lastName: 'Example',
      dateOfBirth: '2000-01-01',
    });

    expect(result.verificationStatus).toBe('failed');
    expect(result.failureReason).toBeDefined();
  });
});
