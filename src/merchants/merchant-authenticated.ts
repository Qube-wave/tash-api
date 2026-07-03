import { Merchant } from './entities/merchant.entity';
import { MerchantApiKeyEnvironment } from './entities/merchant-api-key.entity';

export interface AuthenticatedMerchant {
  merchant: Merchant;
  apiKeyId: number;
  environment: MerchantApiKeyEnvironment;
}
