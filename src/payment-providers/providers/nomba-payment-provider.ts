import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import {
  AuthorizeDirectDebitMandateInput,
  ChargeDirectDebitMandateInput,
  ChargeSavedCardInput,
  CompleteCardRegistrationInput,
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
  VerifyBvnInput,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class NombaPaymentProvider implements PaymentProvider {
  createCustomer(
    input: CreateProviderCustomerInput,
  ): Promise<ProviderCustomer> {
    void input;
    return Promise.reject(this.notImplemented('createCustomer'));
  }

  verifyBvn(input: VerifyBvnInput): Promise<ProviderBvnVerification> {
    void input;
    // TODO: Wire this to Nomba only after BVN/customer identity documentation and credentials are available.
    return Promise.reject(this.notImplemented('verifyBvn'));
  }

  initializeCardRegistration(
    input: InitializeCardRegistrationInput,
  ): Promise<ProviderCardRegistrationSession> {
    void input;
    // TODO: Implement with Nomba tokenized card/checkout documentation.
    return Promise.reject(this.notImplemented('initializeCardRegistration'));
  }

  completeCardRegistration(
    input: CompleteCardRegistrationInput,
  ): Promise<ProviderCard> {
    void input;
    return Promise.reject(this.notImplemented('completeCardRegistration'));
  }

  chargeCard(input: ChargeSavedCardInput): Promise<ProviderPaymentResult> {
    void input;
    return Promise.reject(this.notImplemented('chargeCard'));
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

  private notImplemented(feature: string): AppException {
    return new AppException(
      ErrorCode.ProviderUnavailable,
      `Nomba provider ${feature} is not configured yet.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
