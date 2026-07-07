import { createHmac } from 'node:crypto';
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
  nombaEncryptionKey: 'encryption-key',
  nombaWebhookSignatureKey: 'webhook-signature-key',
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

  it('verifies and parses Nomba webhook signatures', async () => {
    const { provider } = createProvider();
    const payload = {
      event_type: 'payment_success',
      requestId: 'request-123',
      data: {
        merchant: {
          userId: 'merchant-user',
          walletId: 'merchant-wallet',
        },
        transaction: {
          transactionId: 'transaction-123',
          type: 'card',
          time: '2026-07-07T07:30:00.000Z',
          responseCode: '00',
        },
      },
    };
    const timestamp = '2026-07-07T07:30:01.000Z';
    const signaturePayload =
      'payment_success:request-123:merchant-user:merchant-wallet:transaction-123:card:2026-07-07T07:30:00.000Z:00:2026-07-07T07:30:01.000Z';
    const signature = createHmac('sha256', 'webhook-signature-key')
      .update(signaturePayload)
      .digest('base64');

    await expect(
      provider.verifyWebhook(
        {
          'nomba-signature': signature,
          'nomba-signature-algorithm': 'HmacSHA256',
          'nomba-timestamp': timestamp,
        },
        Buffer.from(JSON.stringify(payload)),
      ),
    ).resolves.toBe(true);

    await expect(provider.parseWebhook(payload)).resolves.toMatchObject({
      provider: 'nomba',
      providerEventId: 'request-123',
      eventType: 'payment_success',
    });
  });

  it('resolves a bank account with Nomba lookup', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          accountNumber: '0554772814',
          accountName: 'M.A Animashaun',
        },
      },
    });

    const result = await provider.resolveBankAccount({
      bankCode: '053',
      accountNumber: '0554772814',
    });

    expect(result).toEqual({
      bankCode: '053',
      accountNumber: '0554772814',
      accountName: 'M.A Animashaun',
      bankName: undefined,
    });
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v1/transfers/bank/lookup',
      data: {
        accountNumber: '0554772814',
        bankCode: '053',
      },
      headers: {
        Authorization: 'Bearer nomba-access-token',
        accountId: 'parent-account',
      },
    });
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
          key: 'encryption-key',
          saveCard: true,
          orderReference: 'nomba_order_ref',
          cardDetails: JSON.stringify({
            cardCVV: 123,
            cardExpiryMonth: 12,
            cardExpiryYear: 2030,
            cardNumber: '4111111111111111',
            cardPin: 1234,
          }),
        }),
      }),
    );
  });

  it('reads Nomba transaction id field variants from card details responses', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          status: 'true',
          responseCode: 'T0',
          transactionID: 'transaction-id-variant',
        },
      },
    });

    const result = await provider.submitCardDetails({
      reference: 'nomba_order_ref',
      cardNumber: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '30',
      cvv: '123',
    });

    expect(result.metadata.transactionId).toBe('transaction-id-variant');
  });

  it('rejects OTP submission without a real transaction id', async () => {
    const { client, provider } = createProvider();

    const result = await provider.submitCardOtp({
      reference: 'nomba_order_ref',
      transactionId: 'nomba_order_ref',
      otp: '123456',
      phoneNumber: '08012345678',
    });

    expect(result).toMatchObject({
      status: 'failed',
      failureReason:
        'Card transaction id is missing. Submit card details again before OTP verification.',
    });
    expect(client.request).not.toHaveBeenCalled();
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

  it('surfaces nested Nomba provider error messages', async () => {
    const { client, provider } = createProvider();
    client.request.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          code: '99',
          data: {
            message: 'Invalid card expiry date',
          },
        },
      },
    });
    jest.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(
      provider.submitCardDetails({
        reference: 'nomba_order_ref',
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '30',
        cvv: '123',
      }),
    ).rejects.toThrow('Invalid card expiry date');
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

  it('creates a Nomba direct debit mandate', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          mandateId: 'mandate-id',
          merchantReference: '1234567890',
          customerPhoneNumber: '08012345678',
          description: 'Pay N50.00 into 9880218357 with Paystack-Titan Bank.',
        },
      },
    });

    const result = await provider.createDirectDebitMandate({
      userUuid: 'user-uuid',
      bankCode: '090405',
      accountNumber: '0123456789',
      accountName: 'Test User',
      customerName: 'Test User',
      customerEmail: 'user@example.com',
      customerPhoneNumber: '+2348012345678',
      customerAddress: 'NG',
      maximumAmount: 10000,
      currency: 'NGN',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerCustomerId: 'user-uuid',
      providerMandateId: 'mandate-id',
      authorizationReference: '1234567890',
      status: 'requires_authorization',
      accountName: 'Test User',
      accountNumberLastFour: '6789',
      bankCode: '90405',
      metadata: {
        authorizationDescription:
          'Pay N50.00 into 9880218357 with Paystack-Titan Bank.',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/direct-debits',
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
        data: expect.objectContaining({
          customerAccountNumber: '0123456789',
          bankCode: '90405',
          customerName: 'Test User',
          customerAddress: 'Nigeria',
          customerAccountName: 'Test User',
          customerPhoneNumber: '08012345678',
          customerEmail: 'user@example.com',
          frequency: 'VARIABLE',
          narration: 'Tash direct debit mandate',
          merchantReference: expect.stringMatching(/^\d+$/),
          startImmediately: true,
        }),
      }),
    );
  });

  it('checks a Nomba direct debit mandate status during authorization', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          mandateId: 'mandate-id',
          customerAccountName: 'Test User',
          customerAccountNumber: '0123456789',
          bankCode: '058',
          mandateStatus: 'Active',
          mandateAdviceStatus: 'Advice Sent',
        },
      },
    });

    const result = await provider.authorizeDirectDebitMandate({
      providerMandateId: 'mandate-id',
      authorizationReference: '1234567890',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerMandateId: 'mandate-id',
      authorizationReference: '1234567890',
      status: 'active',
      accountName: 'Test User',
      accountNumberLastFour: '6789',
      bankCode: '058',
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/v1/direct-debits/status?mandateId=mandate-id',
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
      }),
    );
  });

  it('revokes a Nomba direct debit mandate by suspending it', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          items: [
            {
              mandateId: 'mandate-id',
              status: 'SUSPEND',
              customerAccountName: 'Test User',
              customerAccountNumber: '0123456789',
              bankCode: '058',
            },
          ],
        },
      },
    });

    const result = await provider.revokeDirectDebitMandate({
      providerMandateId: 'mandate-id',
      reason: 'User revoked mandate',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerMandateId: 'mandate-id',
      status: 'revoked',
      accountName: 'Test User',
      accountNumberLastFour: '6789',
      bankCode: '058',
      metadata: {
        reason: 'User revoked mandate',
        customerAccountNumberLastFour: '6789',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/v1/direct-debits/update-status',
        data: {
          mandateId: 'mandate-id',
          status: 'SUSPEND',
        },
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
      }),
    );
  });

  it('charges a Nomba direct debit mandate', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          mandateId: 'mandate-id',
          status: 'SUCCESS',
          amount: '110.00',
          message: 'Approved or completed successfully',
        },
      },
    });

    const result = await provider.chargeDirectDebitMandate({
      providerMandateId: 'mandate-id',
      amount: 110,
      currency: 'NGN',
      reference: 'direct_debit_charge_ref',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerReference: 'mandate-id',
      status: 'successful',
      metadata: {
        reference: 'direct_debit_charge_ref',
        currency: 'NGN',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/direct-debits/debit-mandate',
        data: {
          mandateId: 'mandate-id',
          amount: '110.00',
        },
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
      }),
    );
  });

  it('creates a Nomba virtual account', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '00',
        data: {
          accountRef: 'account-ref',
          accountHolderId: 'account-holder-id',
          accountName: 'Test User',
          bankAccountNumber: '91714245345',
          bankAccountName: 'Test User/Tash',
          bankName: 'Amucha MFB',
          currency: 'NGN',
          expiryDate: '2026-07-07T22:00:00',
          expired: false,
        },
      },
    });
    const expiresAt = new Date('2026-07-07T22:00:00.000Z');

    const result = await provider.createVirtualAccount({
      userUuid: 'user-uuid',
      walletUuid: 'wallet-uuid',
      accountName: 'Test User',
      currency: 'NGN',
      type: 'temporary',
      purpose: 'wallet_funding',
      expiresAt,
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerCustomerId: 'account-holder-id',
      providerAccountId: 'account-ref',
      accountName: 'Test User/Tash',
      accountNumber: '91714245345',
      bankName: 'Amucha MFB',
      metadata: {
        accountRef: 'account-ref',
        type: 'temporary',
        purpose: 'wallet_funding',
        walletUuid: 'wallet-uuid',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/accounts/virtual',
        data: expect.objectContaining({
          accountRef: expect.stringMatching(/^tash_va_/),
          accountName: 'Test User',
          currency: 'NGN',
          expiryDate: '2026-07-07T22:00',
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
      }),
    );
  });

  it('performs a successful Nomba bank transfer payout', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '200',
        description: 'SUCCESS',
        status: true,
        data: {
          id: 'transfer-id',
          status: 'SUCCESS',
          amount: 3500,
          meta: {
            merchantTxRef: 'transfer_ref',
          },
        },
      },
    });

    const result = await provider.sendBankTransfer({
      amount: 3500,
      currency: 'NGN',
      reference: 'transfer_ref',
      bankCode: '058',
      accountNumber: '0554728140',
      accountName: 'Test User',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerReference: 'transfer-id',
      status: 'successful',
      metadata: {
        merchantTxRef: 'transfer_ref',
      },
    });
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v2/transfers/bank',
        data: {
          amount: 3500,
          accountNumber: '0554728140',
          accountName: 'Test User',
          bankCode: '058',
          merchantTxRef: 'transfer_ref',
          senderName: 'Tash',
          narration: 'Tash payout transfer',
        },
        headers: expect.objectContaining({
          Authorization: 'Bearer nomba-access-token',
          accountId: 'parent-account',
        }),
      }),
    );
  });

  it('maps processing Nomba bank transfer payouts as pending', async () => {
    const { client, provider } = createProvider();
    client.request.mockResolvedValueOnce({
      data: {
        code: '201',
        description: 'PROCESSING',
        status: false,
        data: {
          id: 'transfer-id',
          status: 'PENDING_BILLING',
        },
      },
    });

    const result = await provider.sendBankTransfer({
      amount: 3500,
      currency: 'NGN',
      reference: 'transfer_ref',
      bankCode: '058',
      accountNumber: '0554728140',
      accountName: 'Test User',
    });

    expect(result).toMatchObject({
      provider: 'nomba',
      providerReference: 'transfer-id',
      status: 'pending',
    });
  });
});
