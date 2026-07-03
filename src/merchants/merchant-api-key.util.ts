import { randomBytes, timingSafeEqual } from 'node:crypto';
import { MerchantApiKeyEnvironment } from './entities/merchant-api-key.entity';

export interface ParsedMerchantApiKey {
  environment: MerchantApiKeyEnvironment;
  keyPrefix: string;
  secret: string;
}

export function createMerchantApiKey(environment: MerchantApiKeyEnvironment): {
  fullKey: string;
  keyPrefix: string;
  secret: string;
} {
  const keyPrefix = createKeyPart(5);
  const secret = createKeyPart(24);
  return {
    fullKey: `tash_${environment}_${keyPrefix}_${secret}`,
    keyPrefix,
    secret,
  };
}

export function parseMerchantApiKey(
  value: string,
): ParsedMerchantApiKey | null {
  const [brand, environment, keyPrefix, secret, extra] = value.split('_');
  if (
    brand !== 'tash' ||
    keyPrefix === undefined ||
    secret === undefined ||
    extra !== undefined
  ) {
    return null;
  }

  if (environment !== 'test' && environment !== 'live') {
    return null;
  }

  return {
    environment:
      environment === 'test'
        ? MerchantApiKeyEnvironment.Test
        : MerchantApiKeyEnvironment.Live,
    keyPrefix,
    secret,
  };
}

export function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createKeyPart(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url').replaceAll('_', '-');
}
