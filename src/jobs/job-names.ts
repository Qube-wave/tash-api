export const MERCHANT_WEBHOOK_QUEUE = 'merchant-webhook-delivery';
export const PROVIDER_VERIFICATION_QUEUE = 'provider-transaction-verification';

export interface MerchantWebhookDeliveryJobData {
  deliveryId: number;
}

export interface ProviderVerificationJobData {
  transactionReference: string;
}
