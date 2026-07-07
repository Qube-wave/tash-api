import { Injectable } from '@nestjs/common';
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

const sandboxMetadata = { sandbox: true };

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  createCustomer(
    input: CreateProviderCustomerInput,
  ): Promise<ProviderCustomer> {
    return Promise.resolve({
      provider: 'mock',
      providerCustomerId: `mock_customer_${input.userUuid}`,
    });
  }

  verifyBvn(input: VerifyBvnInput): Promise<ProviderBvnVerification> {
    const failed = input.bvn.endsWith('000');

    return Promise.resolve({
      provider: 'mock',
      providerCustomerId: failed
        ? undefined
        : `mock_customer_bvn_${input.bvn.slice(-4)}`,
      verificationReference: `mock_bvn_${input.bvn.slice(-6)}`,
      verificationStatus: failed ? 'failed' : 'verified',
      verifiedFirstName: input.firstName,
      verifiedLastName: input.lastName,
      verifiedDateOfBirth: input.dateOfBirth,
      verifiedPhoneNumber: input.phoneNumber ?? '',
      failureReason: failed ? 'Mock BVN verification failed.' : undefined,
      metadata: sandboxMetadata,
    });
  }

  initializeCardRegistration(
    input: InitializeCardRegistrationInput,
  ): Promise<ProviderCardRegistrationSession> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      reference: 'mock_card_session',
      metadata: sandboxMetadata,
    });
  }

  submitCardDetails(
    input: SubmitCardDetailsInput,
  ): Promise<ProviderCardRegistrationStep> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      reference: 'mock_card_session',
      status: 'requires_otp',
      metadata: {
        ...sandboxMetadata,
        nextAction: 'submit_otp',
      },
    });
  }

  submitCardOtp(
    input: SubmitCardOtpInput,
  ): Promise<ProviderCardRegistrationStep> {
    return Promise.resolve({
      provider: 'mock',
      reference: input.reference,
      status: input.otp === '000000' ? 'failed' : 'successful',
      failureReason:
        input.otp === '000000' ? 'Mock card OTP failed.' : undefined,
      metadata: sandboxMetadata,
    });
  }

  completeCardRegistration(
    input: CompleteCardRegistrationInput,
  ): Promise<ProviderCard> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerCustomerId: 'mock_customer',
      providerCardToken: 'mock_card_token',
      authorizationReference: 'mock_auth_ref',
      brand: 'visa',
      lastFourDigits: '1111',
      expiryMonth: '12',
      expiryYear: '2030',
      metadata: sandboxMetadata,
    });
  }

  chargeCard(input: ChargeSavedCardInput): Promise<ProviderPaymentResult> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerReference: 'mock_card_charge',
      status: 'successful',
      metadata: sandboxMetadata,
    });
  }

  createDirectDebitMandate(
    input: CreateDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerMandateId: 'mock_mandate',
      status: 'active',
      metadata: sandboxMetadata,
    });
  }

  authorizeDirectDebitMandate(
    input: AuthorizeDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerMandateId: 'mock_mandate',
      status: 'active',
      metadata: sandboxMetadata,
    });
  }

  chargeDirectDebitMandate(
    input: ChargeDirectDebitMandateInput,
  ): Promise<ProviderPaymentResult> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerReference: 'mock_direct_debit_charge',
      status: 'successful',
      metadata: sandboxMetadata,
    });
  }

  createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<ProviderVirtualAccount> {
    const suffix = input.walletUuid
      .replaceAll('-', '')
      .slice(-10)
      .padStart(10, '0');
    return Promise.resolve({
      provider: 'mock',
      providerCustomerId: `mock_customer_${input.userUuid}`,
      providerAccountId: `mock_va_${input.walletUuid}`,
      accountName: 'Mock User',
      accountNumber: suffix,
      bankName: 'Mock Bank',
      bankCode: '999',
      metadata: {
        ...sandboxMetadata,
        purpose: input.purpose,
        type: input.type,
      },
    });
  }

  resolveBankAccount(
    input: ResolveBankAccountInput,
  ): Promise<ProviderBankAccount> {
    return Promise.resolve({
      ...input,
      accountName: 'Mock Account',
      bankName: 'Mock Bank',
    });
  }

  sendBankTransfer(
    input: SendBankTransferInput,
  ): Promise<ProviderTransferResult> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerReference: 'mock_transfer',
      status: 'successful',
      metadata: sandboxMetadata,
    });
  }

  refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult> {
    void input;
    return Promise.resolve({
      provider: 'mock',
      providerReference: 'mock_refund',
      status: 'successful',
      metadata: sandboxMetadata,
    });
  }

  verifyTransaction(reference: string): Promise<ProviderTransaction> {
    return Promise.resolve({
      provider: 'mock',
      providerReference: reference,
      status: 'successful',
      metadata: sandboxMetadata,
    });
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<boolean> {
    void headers;
    void rawBody;
    return Promise.resolve(true);
  }

  parseWebhook(payload: unknown): Promise<NormalizedWebhookEvent> {
    return Promise.resolve({
      provider: 'mock',
      providerEventId: 'mock_event',
      eventType: 'mock.event',
      payload:
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {},
    });
  }
}
