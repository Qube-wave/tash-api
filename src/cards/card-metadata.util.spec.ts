import { sanitizeCardProviderMetadata } from './card-metadata.util';

describe('card metadata sanitizer', () => {
  it('removes sensitive top-level card metadata fields', () => {
    expect(
      sanitizeCardProviderMetadata({
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2030',
        cvv: '123',
        otp: '456789',
        providerReference: 'ref_123',
        nextAction: 'submit_otp',
      }),
    ).toEqual({
      providerReference: 'ref_123',
      nextAction: 'submit_otp',
    });
  });

  it('removes sensitive card metadata recursively', () => {
    expect(
      sanitizeCardProviderMetadata({
        nested: {
          pan: '4111111111111111',
          safe: 'value',
        },
        list: [
          {
            cvc: '123',
            keep: true,
          },
        ],
      }),
    ).toEqual({
      nested: {
        safe: 'value',
      },
      list: [
        {
          keep: true,
        },
      ],
    });
  });

  it('returns an empty object for empty provider metadata', () => {
    expect(sanitizeCardProviderMetadata(null)).toEqual({});
    expect(sanitizeCardProviderMetadata(undefined)).toEqual({});
  });
});
