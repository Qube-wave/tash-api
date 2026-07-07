import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { NombaPaymentProvider } from './nomba-payment-provider';

jest.mock('axios');

const paymentProviderConfig = {
  activeProvider: 'nomba' as const,
  nombaBaseUrl: 'https://sandbox.nomba.com',
  nombaParentAccountId: 'parent-account',
  nombaSubAccountId: 'sub-account',
  nombaClientId: 'client-id',
  nombaPrivateKey: 'private-key',
  nombaCardTokenizationAmount: '50.00',
};

const appConfig = {
  baseUrl: 'https://api.tash.test',
};

function createProvider() {
  const client = {
    post: jest.fn().mockResolvedValue({
      data: {
        code: '00',
        data: {
          access_token: 'nomba-access-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      },
    }),
    request: jest.fn(),
  };

  jest.mocked(axios.create).mockReturnValue(client as unknown as AxiosInstance);

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'paymentProvider') {
        return paymentProviderConfig;
      }

      if (key === 'app') {
        return appConfig;
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;

  return {
    client,
    provider: new NombaPaymentProvider(configService),
  };
}

describe('NombaPaymentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a tokenized card checkout order', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          checkoutLink: 'https://checkout.nomba.test/order',
          orderReference: 'nomba_order_ref',
        },
      },
    });

    const result = await provider.initializeCardRegistration({
      userUuid: 'user-uuid',
      email: 'user@example.com',
      phoneNumber: '+2348000000000',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      reference: 'nomba_order_ref',
      authorizationUrl: 'https://checkout.nomba.test/order',
    });
    expect(client.post).toHaveBeenCalledWith(
      '/v1/auth/token/issue',
      {
        grant_type: 'client_credentials',
        client_id: 'client-id',
        client_secret: 'private-key',
      },
      { headers: { accountId: 'parent-account' } },
    );
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/checkout/order',
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
        data: expect.objectContaining({
          tokenizeCard: true,
          order: expect.objectContaining({
            amount: '50.00',
            currency: 'NGN',
            callbackUrl:
              'https://api.tash.test/api/v1/payment-providers/nomba/callback',
          }),
        }),
      }),
    );
  });

  it('submits card details and maps the next OTP step', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          status: 'true',
          responseCode: '00',
          transactionId: 'transaction-id',
        },
      },
    });

    const result = await provider.submitCardDetails({
      reference: 'nomba_order_ref',
      cardNumber: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '30',
      cvv: '123',
      cardPin: '1234',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      reference: 'nomba_order_ref',
      status: 'requires_otp',
      metadata: {
        transactionId: 'transaction-id',
        nextAction: 'submit_otp',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/v1/checkout/checkout-card-detail',
        data: expect.objectContaining({
          saveCard: true,
          orderReference: 'nomba_order_ref',
          cardDetails: expect.objectContaining({
            cardExpiryYear: 2030,
            cardPin: '1234',
          }),
        }),
      }),
    );
  });

  it('submits card OTP and maps a successful verification', async () => {
    const { client, provider } = createProvider();
    client.request
      .mockResolvedValueOnce({
        data: {
          code: '00',
          data: {
            status: 'true',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          code: '00',
          data: {
            success: 'true',
          },
        },
      });

    const result = await provider.submitCardOtp({
      reference: 'nomba_order_ref',
      transactionId: 'transaction-id',
      otp: '123456',
      phoneNumber: '08012345678',
    });

    expect(result.status).toBe('successful');
    expect(client.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/v1/checkout/checkout-card-otp',
        data: {
          otp: '123456',
          orderReference: 'nomba_order_ref',
          transactionId: 'transaction-id',
        },
      }),
    );
    expect(client.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/v1/checkout/user-card',
        data: {
          otp: '123456',
          orderReference: 'nomba_order_ref',
          phoneNumber: '08012345678',
        },
      }),
    );
  });

  it('maps a returned tokenized card', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          tokenizedCardData: [
            {
              tokenKey: 'token-key',
              customerEmail: 'user@example.com',
              cardType: 'VISA',
              cardPan: '************1111',
              tokenExpirationDate: '12/30',
            },
          ],
        },
      },
    });

    const result = await provider.completeCardRegistration({
      reference: 'nomba_order_ref',
    });

    expect(result).toEqual({
      provider: 'nomba',
      providerCustomerId: 'user@example.com',
      providerCardToken: 'token-key',
      authorizationReference: 'nomba_order_ref',
      brand: 'visa',
      lastFourDigits: '1111',
      expiryMonth: '12',
      expiryYear: '2030',
      metadata: {
        tokenExpirationDate: '12/30',
      },
    });
  });

  it('charges a saved tokenized card', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          status: 'true',
          transactionId: 'charge-transaction-id',
        },
      },
    });

    const result = await provider.chargeCard({
      amount: 2500,
      currency: 'NGN',
      providerCardToken: 'token-key',
      reference: 'charge_ref',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerReference: 'charge-transaction-id',
      status: 'successful',
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/v1/checkout/tokenized-card-payment',
        data: {
          tokenKey: 'token-key',
          order: {
            amount: '2500.00',
            currency: 'NGN',
            orderReference: 'charge_ref',
            accountId: 'parent-account',
          },
        },
      }),
    );
  });
});
