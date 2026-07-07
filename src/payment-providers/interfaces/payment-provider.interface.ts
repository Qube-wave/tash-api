export interface CreateProviderCustomerInput {
  userUuid: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
}

export interface ProviderCustomer {
  provider: string;
  providerCustomerId: string;
}

export interface VerifyBvnInput {
  bvn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber?: string | null;
}

export type ProviderBvnVerificationStatus =
  'pending' | 'verified' | 'failed' | 'rejected';

export interface ProviderBvnVerification {
  provider: string;
  providerCustomerId?: string;
  verificationReference: string;
  verificationStatus: ProviderBvnVerificationStatus;
  verifiedFirstName?: string;
  verifiedLastName?: string;
  verifiedDateOfBirth?: string;
  verifiedPhoneNumber?: string;
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface InitializeCardRegistrationInput {
  userUuid: string;
  email: string | null;
  phoneNumber?: string | null;
}

export interface ProviderCardRegistrationSession {
  reference: string;
  provider: string;
  authorizationUrl?: string;
  metadata: Record<string, unknown>;
}

export interface SubmitCardDetailsInput {
  reference: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName?: string;
  cardPin?: string;
}

export interface SubmitCardOtpInput {
  reference: string;
  otp: string;
  transactionId?: string;
  phoneNumber?: string | null;
}

export interface ResendCardOtpInput {
  reference: string;
  transactionId?: string;
}

export interface CompleteCardRegistrationInput {
  reference: string;
}

export type ProviderCardRegistrationStepStatus =
  'pending' | 'requires_otp' | 'successful' | 'failed';

export interface ProviderCardRegistrationStep {
  provider: string;
  reference: string;
  status: ProviderCardRegistrationStepStatus;
  authorizationUrl?: string;
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface ProviderCard {
  provider: string;
  providerCustomerId: string;
  providerCardToken: string;
  authorizationReference: string;
  brand: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  metadata: Record<string, unknown>;
}

export interface ChargeSavedCardInput {
  amount: number;
  currency: string;
  providerCardToken: string;
  reference: string;
}

export interface ProviderPaymentResult {
  provider: string;
  providerReference: string;
  status: 'pending' | 'requires_action' | 'successful' | 'failed';
  failureCode?: string;
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface CreateDirectDebitMandateInput {
  userUuid: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  customerName: string;
  customerEmail: string;
  customerPhoneNumber: string;
  customerAddress?: string | null;
  maximumAmount: number;
  currency: string;
}

export interface AuthorizeDirectDebitMandateInput {
  providerMandateId: string;
  authorizationReference: string;
}

export interface RevokeDirectDebitMandateInput {
  providerMandateId: string;
  reason?: string;
}

export interface ProviderDirectDebitMandate {
  provider: string;
  providerCustomerId?: string;
  providerMandateId: string;
  authorizationReference?: string;
  status:
    | 'pending'
    | 'requires_authorization'
    | 'active'
    | 'failed'
    | 'expired'
    | 'revoked';
  bankName?: string;
  accountName?: string;
  accountNumberLastFour?: string;
  bankCode?: string;
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface ChargeDirectDebitMandateInput {
  providerMandateId: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface CreateVirtualAccountInput {
  userUuid: string;
  walletUuid: string;
  currency: string;
  type: 'static' | 'temporary';
  purpose: 'wallet_funding' | 'refund';
}

export interface ProviderVirtualAccount {
  provider: string;
  providerCustomerId?: string;
  providerAccountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  metadata: Record<string, unknown>;
}

export interface ProviderBank {
  name: string;
  code: string;
  country: string;
  currency: string;
  metadata: Record<string, unknown>;
}

export interface ResolveBankAccountInput {
  bankCode: string;
  accountNumber: string;
}

export interface ProviderBankAccount {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankName?: string;
}

export interface SendBankTransferInput {
  amount: number;
  currency: string;
  reference: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface ProviderTransferResult {
  provider: string;
  providerReference: string;
  status: 'pending' | 'successful' | 'failed';
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface RefundPaymentInput {
  providerReference: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface ProviderRefundResult {
  provider: string;
  providerReference: string;
  status: 'pending' | 'successful' | 'failed';
  failureReason?: string;
  metadata: Record<string, unknown>;
}

export interface ProviderTransaction {
  provider: string;
  providerReference: string;
  status: 'pending' | 'successful' | 'failed' | 'reversed';
  amount?: number;
  currency?: string;
  metadata: Record<string, unknown>;
}

export interface NormalizedWebhookEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomer>;
  verifyBvn(input: VerifyBvnInput): Promise<ProviderBvnVerification>;
  initializeCardRegistration(
    input: InitializeCardRegistrationInput,
  ): Promise<ProviderCardRegistrationSession>;
  submitCardDetails(
    input: SubmitCardDetailsInput,
  ): Promise<ProviderCardRegistrationStep>;
  submitCardOtp(
    input: SubmitCardOtpInput,
  ): Promise<ProviderCardRegistrationStep>;
  resendCardOtp(
    input: ResendCardOtpInput,
  ): Promise<ProviderCardRegistrationStep>;
  completeCardRegistration(
    input: CompleteCardRegistrationInput,
  ): Promise<ProviderCard>;
  chargeCard(input: ChargeSavedCardInput): Promise<ProviderPaymentResult>;
  createDirectDebitMandate(
    input: CreateDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate>;
  authorizeDirectDebitMandate(
    input: AuthorizeDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate>;
  revokeDirectDebitMandate(
    input: RevokeDirectDebitMandateInput,
  ): Promise<ProviderDirectDebitMandate>;
  chargeDirectDebitMandate(
    input: ChargeDirectDebitMandateInput,
  ): Promise<ProviderPaymentResult>;
  createVirtualAccount(
    input: CreateVirtualAccountInput,
  ): Promise<ProviderVirtualAccount>;
  listBanks(): Promise<ProviderBank[]>;
  resolveBankAccount(
    input: ResolveBankAccountInput,
  ): Promise<ProviderBankAccount>;
  sendBankTransfer(
    input: SendBankTransferInput,
  ): Promise<ProviderTransferResult>;
  refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult>;
  verifyTransaction(reference: string): Promise<ProviderTransaction>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<boolean>;
  parseWebhook(payload: unknown): Promise<NormalizedWebhookEvent>;
}
