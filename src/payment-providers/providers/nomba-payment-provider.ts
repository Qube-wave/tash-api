import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { PaymentProviderConfiguration } from '../../config/payment-provider.config';
import { AppConfiguration } from '../../config/app.config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import {
  AuthorizeDirectDebitMandateInput,
  ChargeDirectDebitMandateInput,
  ChargeSavedCardInput,
  CompleteCardRegistrationInput,
  ProviderCardRegistrationStep,
  CreateDirectDebitMandateInput,
  CreateProviderCustomerInput,
  CreateVirtualAccountInput,
  InitializeCardRegistrationInput,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderBankAccount,
  ProviderBvnVerification,
  ProviderCard,
  ProviderCardRegistrationSession,
  ProviderCustomer,
  ProviderDirectDebitMandate,
  ProviderPaymentResult,
  ProviderRefundResult,
  ProviderTransaction,
  ProviderTransferResult,
  ProviderVirtualAccount,
  RefundPaymentInput,
  ResolveBankAccountInput,
  SendBankTransferInput,
  SubmitCardDetailsInput,
  SubmitCardOtpInput,
  VerifyBvnInput,
} from '../interfaces/payment-provider.interface';

interface NombaAuthData {
  access_token?: unknown;
  expiresAt?: unknown;
}

interface NombaEnvelope<T> {
  code?: unknown;
  description?: unknown;
  data?: T;
}

interface NombaCheckoutOrderData {
  checkoutLink?: unknown;
  orderReference?: unknown;
}

interface NombaCardDetailsData {
  status?: unknown;
  message?: unknown;
  responseCode?: unknown;
  transactionId?: unknown;
  secureAuthenticationData?: unknown;
}

interface NombaCardOtpData {
  status?: unknown;
  message?: unknown;
  success?: unknown;
}

interface NombaUserCardOtpData {
  success?: unknown;
  message?: unknown;
}

interface NombaSavedCardsData {
  tokenizedCardData?: unknown;
}

interface NombaTokenizedCard {
  tokenKey?: unknown;
  customerEmail?: unknown;
  cardType?: unknown;
  cardPan?: unknown;
  tokenExpirationDate?: unknown;
}

interface NombaTokenizedChargeData {
  status?: unknown;
  message?: unknown;
  transactionId?: unknown;
  orderReference?: unknown;
}

interface CachedNombaToken {
  accessToken: string;
  expiresAtMs: number;
}

@Injectable()
export class NombaPaymentProvider implements PaymentProvider {
  private readonly client: AxiosInstance;
  private cachedToken: CachedNombaToken | null = null;

  constructor(private readonly configService: ConfigService) {
    const config = this.getPaymentConfig();
    this.client = axios.create({
      baseURL: config.nombaBaseUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  createCustomer(
    input: CreateProviderCustomerInput,
  ): Promise<ProviderCustomer> {
    void input;
    return Promise.reject(this.notImplemented('createCustomer'));
  }

  verifyBvn(input: VerifyBvnInput): Promise<ProviderBvnVerification> {
    void input;
    return Promise.reject(this.notImplemented('verifyBvn'));
  }

  async initializeCardRegistration(
    input: InitializeCardRegistrationInput,
  ): Promise<ProviderCardRegistrationSession> {
    const config = this.getReadyPaymentConfig();
    const appConfig = this.configService.getOrThrow<AppConfiguration>('app');
    const reference = `nomba_card_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
    const response = await this.request<NombaEnvelope<NombaCheckoutOrderData>>({
      method: 'POST',
      url: '/v1/checkout/order',
      accountScoped: true,
      data: {
        order: {
          callbackUrl: `${appConfig.baseUrl}/api/v1/payment-providers/nomba/callback`,
          customerEmail: input.email,
          amount: config.nombaCardTokenizationAmount,
          currency: 'NGN',
          orderReference: reference,
          customerId: input.userUuid,
          accountId: config.nombaParentAccountId,
          allowedPaymentMethods: ['Card'],
          orderMetaData: {
            purpose: 'card_tokenization',
            userUuid: input.userUuid,
          },
        },
        tokenizeCard: true,
      },
    });
    const data = this.assertSuccessfulEnvelope(
      response.data,
      'Card order creation failed.',
    );
    const orderReference = this.readString(data.orderReference) ?? reference;

    return {
      provider: 'nomba',
      reference: orderReference,
      authorizationUrl: this.readString(data.checkoutLink),
      metadata: {
        orderReference,
        checkoutLink: this.readString(data.checkoutLink),
        tokenizationAmount: config.nombaCardTokenizationAmount,
      },
    };
  }

  async submitCardDetails(
    input: SubmitCardDetailsInput,
  ): Promise<ProviderCardRegistrationStep> {
    const response = await this.request<NombaEnvelope<NombaCardDetailsData>>({
      method: 'POST',
      url: '/v1/checkout/checkout-card-detail',
      data: {
        cardDetails: {
          cardCVV: input.cvv,
          cardExpiryMonth: Number(input.expiryMonth),
          cardExpiryYear: Number(this.normalizeExpiryYear(input.expiryYear)),
          cardNumber: input.cardNumber,
          ...(input.cardPin !== undefined ? { cardPin: input.cardPin } : {}),
        },
        key: '',
        orderReference: input.reference,
        saveCard: true,
        deviceInformation: this.defaultDeviceInformation(),
      },
    });
    const data = response.data.data ?? {};

    if (
      !this.isSuccessfulEnvelope(response.data) ||
      this.isFalseLike(data.status)
    ) {
      return {
        provider: 'nomba',
        reference: input.reference,
        status: 'failed',
        failureReason:
          this.readString(data.message) ??
          this.readDescription(response.data) ??
          'Card registration failed.',
        metadata: this.safeProviderMetadata(data),
      };
    }

    return {
      provider: 'nomba',
      reference: input.reference,
      status: 'requires_otp',
      metadata: {
        ...this.safeProviderMetadata(data),
        transactionId: this.readString(data.transactionId) ?? input.reference,
        nextAction: 'submit_otp',
      },
    };
  }

  async submitCardOtp(
    input: SubmitCardOtpInput,
  ): Promise<ProviderCardRegistrationStep> {
    const transactionId = input.transactionId ?? input.reference;
    const response = await this.request<NombaEnvelope<NombaCardOtpData>>({
      method: 'POST',
      url: '/v1/checkout/checkout-card-otp',
      data: {
        otp: input.otp,
        orderReference: input.reference,
        transactionId,
      },
    });
    const data = response.data.data ?? {};

    if (
      !this.isSuccessfulEnvelope(response.data) ||
      this.isFalseLike(data.status)
    ) {
      return {
        provider: 'nomba',
        reference: input.reference,
        status: 'failed',
        failureReason:
          this.readString(data.message) ??
          this.readDescription(response.data) ??
          'Card OTP verification failed.',
        metadata: this.safeProviderMetadata(data),
      };
    }

    const saveCardResult = await this.submitUserCardOtp(input);

    if (saveCardResult.status === 'failed') {
      return saveCardResult;
    }

    return {
      provider: 'nomba',
      reference: input.reference,
      status: 'successful',
      metadata: {
        ...this.safeProviderMetadata(data),
        ...saveCardResult.metadata,
        transactionId,
      },
    };
  }

  async completeCardRegistration(
    input: CompleteCardRegistrationInput,
  ): Promise<ProviderCard> {
    const response = await this.request<NombaEnvelope<NombaSavedCardsData>>({
      method: 'GET',
      url: `/v1/checkout/user-card/${encodeURIComponent(input.reference)}`,
    });
    const data = this.assertSuccessfulEnvelope(
      response.data,
      'Could not fetch saved card from Nomba.',
    );
    const tokenizedCards = this.readTokenizedCards(data.tokenizedCardData);
    const savedCard = tokenizedCards[0];

    if (savedCard === undefined) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        'Nomba did not return a tokenized card for this order.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenKey = this.readString(savedCard.tokenKey);
    if (tokenKey === undefined) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        'Nomba saved card response did not include a token key.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const expiry = this.parseTokenExpirationDate(
      this.readString(savedCard.tokenExpirationDate),
    );

    return {
      provider: 'nomba',
      providerCustomerId: this.readString(savedCard.customerEmail) ?? tokenKey,
      providerCardToken: tokenKey,
      authorizationReference: input.reference,
      brand: this.readString(savedCard.cardType)?.toLowerCase() ?? 'unknown',
      lastFourDigits: this.extractLastFourDigits(
        this.readString(savedCard.cardPan),
      ),
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      metadata: {
        tokenExpirationDate: this.readString(savedCard.tokenExpirationDate),
      },
    };
  }

  async chargeCard(
    input: ChargeSavedCardInput,
  ): Promise<ProviderPaymentResult> {
    const config = this.getReadyPaymentConfig();
    const response = await this.request<
      NombaEnvelope<NombaTokenizedChargeData>
    >({
      method: 'POST',
      url: '/v1/checkout/tokenized-card-payment',
      accountScoped: true,
      data: {
        tokenKey: input.providerCardToken,
        order: {
          amount: this.formatAmount(input.amount),
          currency: input.currency,
          orderReference: input.reference,
          accountId: config.nombaParentAccountId,
        },
      },
    });
    const data = response.data.data ?? {};
    const providerReference =
      this.readString(data.transactionId) ??
      this.readString(data.orderReference) ??
      input.reference;

    if (
      !this.isSuccessfulEnvelope(response.data) ||
      this.isFalseLike(data.status)
    ) {
      return {
        provider: 'nomba',
        providerReference,
        status: 'failed',
        failureReason:
          this.readString(data.message) ??
          this.readDescription(response.data) ??
          'Card charge failed.',
        metadata: this.safeProviderMetadata(data),
      };
    }

    return {
      provider: 'nomba',
      providerReference,
      status: 'successful',
      metadata: this.safeProviderMetadata(data),
    };
  }

  private async submitUserCardOtp(
    input: SubmitCardOtpInput,
  ): Promise<ProviderCardRegistrationStep> {
    if (input.phoneNumber === null || input.phoneNumber === undefined) {
      return {
        provider: 'nomba',
        reference: input.reference,
        status: 'failed',
        failureReason: 'A phone number is required to save a Nomba card.',
        metadata: {},
      };
    }

    const response = await this.request<NombaEnvelope<NombaUserCardOtpData>>({
      method: 'POST',
      url: '/v1/checkout/user-card',
      data: {
        orderReference: input.reference,
        phoneNumber: input.phoneNumber,
        otp: input.otp,
      },
    });
    const data = response.data.data ?? {};

    if (
      !this.isSuccessfulEnvelope(response.data) ||
      this.isFalseLike(data.success)
    ) {
      return {
        provider: 'nomba',
        reference: input.reference,
        status: 'failed',
        failureReason:
          this.readString(data.message) ??
          this.readDescription(response.data) ??
          'Card save OTP verification failed.',
        metadata: this.safeProviderMetadata(data),
      };
    }

    return {
      provider: 'nomba',
      reference: input.reference,
      status: 'successful',
      metadata: {
        ...this.safeProviderMetadata(data),
        savedCardVerified: true,
      },
    };
  }

  createDirectDebitMandate(
    input: CreateDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate> {
    void input;
    return Promise.reject(this.notImplemented('createDirectDebitMandate'));
  }

  authorizeDirectDebitMandate(
    input: AuthorizeDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate> {
    void input;
    return Promise.reject(this.notImplemented('authorizeDirectDebitMandate'));
  }

  chargeDirectDebitMandate(
    input: ChargeDirectDebitMandateInput,
  ): Promise<ProviderPaymentResult> {
    void input;
    return Promise.reject(this.notImplemented('chargeDirectDebitMandate'));
  }

  createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<ProviderVirtualAccount> {
    void input;
    return Promise.reject(this.notImplemented('createVirtualAccount'));
  }

  resolveBankAccount(
    input: ResolveBankAccountInput,
  ): Promise<ProviderBankAccount> {
    void input;
    return Promise.reject(this.notImplemented('resolveBankAccount'));
  }

  sendBankTransfer(
    input: SendBankTransferInput,
  ): Promise<ProviderTransferResult> {
    void input;
    return Promise.reject(this.notImplemented('sendBankTransfer'));
  }

  refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult> {
    void input;
    return Promise.reject(this.notImplemented('refundPayment'));
  }

  verifyTransaction(reference: string): Promise<ProviderTransaction> {
    void reference;
    return Promise.reject(this.notImplemented('verifyTransaction'));
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<boolean> {
    void headers;
    void rawBody;
    return Promise.reject(this.notImplemented('verifyWebhook'));
  }

  parseWebhook(payload: unknown): Promise<NormalizedWebhookEvent> {
    void payload;
    return Promise.reject(this.notImplemented('parseWebhook'));
  }

  private async request<T>({
    accountScoped = false,
    data,
    method,
    url,
  }: {
    accountScoped?: boolean;
    data?: unknown;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
  }): Promise<AxiosResponse<T>> {
    try {
      const token = await this.getAccessToken();
      const config = this.getReadyPaymentConfig();
      const requestConfig: AxiosRequestConfig = {
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(accountScoped ? { accountId: config.nombaParentAccountId } : {}),
        },
      };

      return await this.client.request<T>(requestConfig);
    } catch (error: unknown) {
      throw this.toProviderException(error);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.cachedToken !== null &&
      this.cachedToken.expiresAtMs > now + 300_000
    ) {
      return this.cachedToken.accessToken;
    }

    const config = this.getReadyPaymentConfig();
    try {
      const response = await this.client.post<NombaEnvelope<NombaAuthData>>(
        '/v1/auth/token/issue',
        {
          grant_type: 'client_credentials',
          client_id: config.nombaClientId,
          client_secret: config.nombaPrivateKey,
        },
        {
          headers: {
            accountId: config.nombaParentAccountId,
          },
        },
      );
      const data = this.assertSuccessfulEnvelope(
        response.data,
        'Nomba authentication failed.',
      );
      const accessToken = this.readString(data.access_token);

      if (accessToken === undefined) {
        throw new AppException(
          ErrorCode.ProviderUnavailable,
          'Nomba authentication response did not include an access token.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.cachedToken = {
        accessToken,
        expiresAtMs: this.readExpiresAtMs(data.expiresAt),
      };

      return accessToken;
    } catch (error: unknown) {
      throw this.toProviderException(error);
    }
  }

  private getPaymentConfig(): PaymentProviderConfiguration {
    return this.configService.getOrThrow<PaymentProviderConfiguration>(
      'paymentProvider',
    );
  }

  private getReadyPaymentConfig(): PaymentProviderConfiguration {
    const config = this.getPaymentConfig();
    if (
      config.nombaBaseUrl.trim() === '' ||
      config.nombaParentAccountId.trim() === '' ||
      config.nombaClientId.trim() === '' ||
      config.nombaPrivateKey.trim() === ''
    ) {
      throw this.notImplemented('credentials');
    }

    return config;
  }

  private assertSuccessfulEnvelope<T>(
    envelope: NombaEnvelope<T>,
    fallbackMessage: string,
  ): T {
    if (this.isSuccessfulEnvelope(envelope) && envelope.data !== undefined) {
      return envelope.data;
    }

    throw new AppException(
      ErrorCode.ProviderUnavailable,
      this.readDescription(envelope) ?? fallbackMessage,
      HttpStatus.BAD_GATEWAY,
      this.safeProviderMetadata(envelope),
    );
  }

  private isSuccessfulEnvelope(envelope: NombaEnvelope<unknown>): boolean {
    const code = this.readString(envelope.code);
    return code === undefined || code === '00';
  }

  private readDescription(
    envelope: NombaEnvelope<unknown>,
  ): string | undefined {
    return this.readString(envelope.description);
  }

  private safeProviderMetadata(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private readTokenizedCards(value: unknown): NombaTokenizedCard[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is NombaTokenizedCard =>
        item !== null && typeof item === 'object',
    );
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== ''
      ? value.trim()
      : undefined;
  }

  private isFalseLike(value: unknown): boolean {
    if (value === false) {
      return true;
    }

    return typeof value === 'string' && value.trim().toLowerCase() === 'false';
  }

  private readExpiresAtMs(value: unknown): number {
    const expiresAt = this.readString(value);
    if (expiresAt !== undefined) {
      const parsed = Date.parse(expiresAt);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return Date.now() + 25 * 60 * 1000;
  }

  private normalizeExpiryYear(year: string): string {
    return year.length === 2 ? `20${year}` : year;
  }

  private parseTokenExpirationDate(value: string | undefined): {
    month: string;
    year: string;
  } {
    const [first, second] = value?.split('/').map((part) => part.trim()) ?? [];
    const firstNumber = Number(first);
    const secondNumber = Number(second);

    if (
      Number.isInteger(firstNumber) &&
      firstNumber >= 1 &&
      firstNumber <= 12
    ) {
      return {
        month: String(firstNumber).padStart(2, '0'),
        year: second !== undefined ? this.normalizeExpiryYear(second) : '2099',
      };
    }

    if (
      Number.isInteger(secondNumber) &&
      secondNumber >= 1 &&
      secondNumber <= 12
    ) {
      return {
        month: String(secondNumber).padStart(2, '0'),
        year: first !== undefined ? this.normalizeExpiryYear(first) : '2099',
      };
    }

    return {
      month: '12',
      year: second !== undefined ? this.normalizeExpiryYear(second) : '2099',
    };
  }

  private extractLastFourDigits(maskedPan: string | undefined): string {
    const digits = maskedPan?.replace(/\D/g, '') ?? '';
    return digits.slice(-4).padStart(4, '0');
  }

  private formatAmount(amount: number): string {
    return amount.toFixed(2);
  }

  private defaultDeviceInformation(): Record<string, string> {
    return {
      httpBrowserLanguage: 'en-GB',
      httpBrowserJavaEnabled: 'false',
      httpBrowserJavaScriptEnabled: 'true',
      httpBrowserColorDepth: '24',
      httpBrowserScreenHeight: '900',
      httpBrowserScreenWidth: '1440',
      httpBrowserTimeDifference: '0',
      userAgentBrowserValue: 'Tash API',
      deviceChannel: 'Browser',
    };
  }

  private toProviderException(error: unknown): AppException {
    if (error instanceof AppException) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      return new AppException(
        ErrorCode.ProviderUnavailable,
        this.readNombaErrorMessage(error.response?.data) ??
          'Nomba provider request failed.',
        error.response?.status === 401 || error.response?.status === 403
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.BAD_GATEWAY,
        this.safeProviderMetadata(error.response?.data),
      );
    }

    return new AppException(
      ErrorCode.ProviderUnavailable,
      'Nomba provider request failed.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  private readNombaErrorMessage(value: unknown): string | undefined {
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return (
        this.readString(record.description) ??
        this.readString(record.message) ??
        this.readString(record.error)
      );
    }

    return undefined;
  }

  private notImplemented(feature: string): AppException {
    return new AppException(
      ErrorCode.ProviderUnavailable,
      `Nomba provider ${feature} is not configured yet.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
