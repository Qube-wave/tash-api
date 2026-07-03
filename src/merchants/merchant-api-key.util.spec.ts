import {
  createMerchantApiKey,
  parseMerchantApiKey,
} from './merchant-api-key.util';
import { MerchantApiKeyEnvironment } from './entities/merchant-api-key.entity';

describe('merchant API key utilities', () => {
  it('creates parseable merchant API keys', () => {
    const generated = createMerchantApiKey(MerchantApiKeyEnvironment.Test);
    const parsed = parseMerchantApiKey(generated.fullKey);

    expect(parsed).toMatchObject({
      environment: MerchantApiKeyEnvironment.Test,
      keyPrefix: generated.keyPrefix,
      secret: generated.secret,
    });
  });

  it('rejects malformed keys', () => {
    expect(parseMerchantApiKey('bad_key')).toBeNull();
  });
});
