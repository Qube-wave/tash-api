const SENSITIVE_CARD_METADATA_KEYS = new Set([
  'cardcvc',
  'cardcvv',
  'cardnumber',
  'cardotp',
  'cardpan',
  'cardpin',
  'cvc',
  'cvv',
  'expiration',
  'expirationdate',
  'expirationmonth',
  'expirationyear',
  'expiry',
  'expirydate',
  'expirymonth',
  'expiryyear',
  'number',
  'onetimepassword',
  'otp',
  'otpcode',
  'pan',
  'pin',
  'primaryaccountnumber',
  'securitycode',
]);

export function sanitizeCardProviderMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (metadata === null || metadata === undefined) {
    return {};
  }

  return sanitizeRecord(metadata);
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>(
    (sanitized, [key, value]) => {
      if (isSensitiveCardMetadataKey(key)) {
        return sanitized;
      }

      sanitized[key] = sanitizeValue(value);
      return sanitized;
    },
    {},
  );
}

function isSensitiveCardMetadataKey(key: string): boolean {
  return SENSITIVE_CARD_METADATA_KEYS.has(
    key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
  );
}
