export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  BASE_URL: string;
  NODE_ENV: NodeEnvironment;
  PORT: number;
  APP_NAME: string;
  API_PREFIX: string;
  CORS_ORIGINS: string[];
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  DATABASE_SSL: boolean;
  DATABASE_URL?: string;
  REDIS_URL: string;
  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_TTL_SECONDS: number;
  JWT_REFRESH_TOKEN_TTL_SECONDS: number;
  VERIFICATION_TOKEN_TTL_SECONDS: number;
  PASSWORD_RESET_TOKEN_TTL_SECONDS: number;
  BVN_ENCRYPTION_KEY: string;
  TRANSACTION_PIN_MAX_ATTEMPTS: number;
  TRANSACTION_PIN_LOCK_MINUTES: number;
  PAYMENT_PROVIDER: 'mock' | 'nomba';
  AFRICAS_TALKING_API_KEY: string;
  AFRICAS_TALKING_BASE_URL: string;
  AFRICAS_TALKING_SENDER_ID: string;
  AFRICAS_TALKING_USERNAME: string;
  SKIP_EXTERNAL_CONNECTIONS: boolean;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

const VALID_NODE_ENVIRONMENTS: readonly NodeEnvironment[] = [
  'development',
  'test',
  'production',
];

const VALID_PAYMENT_PROVIDERS = ['mock', 'nomba'] as const;

type PaymentProvider = (typeof VALID_PAYMENT_PROVIDERS)[number];

function readString(
  config: Record<string, string | undefined>,
  key: string,
  defaultValue: string,
): string {
  const value = config[key];
  return value === undefined || value.trim() === '' ? defaultValue : value;
}

function readOptionalString(
  config: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = config[key];
  return value === undefined || value.trim() === '' ? undefined : value;
}

function readNumber(
  config: Record<string, string | undefined>,
  key: string,
  defaultValue: number,
): number {
  const value = readString(config, key, String(defaultValue));
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
}

function readBoolean(
  config: Record<string, string | undefined>,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = readString(config, key, String(defaultValue)).toLowerCase();

  if (['true', '1', 'yes'].includes(value)) {
    return true;
  }

  if (['false', '0', 'no'].includes(value)) {
    return false;
  }

  throw new Error(`${key} must be a boolean`);
}

function readStringList(
  config: Record<string, string | undefined>,
  key: string,
): string[] {
  const value = readOptionalString(config, key);
  if (value === undefined) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function validateEnvironment(
  config: Record<string, string | undefined>,
): EnvironmentVariables {
  const nodeEnv = readString(config, 'NODE_ENV', 'development');

  if (!VALID_NODE_ENVIRONMENTS.includes(nodeEnv as NodeEnvironment)) {
    throw new Error(
      `NODE_ENV must be one of: ${VALID_NODE_ENVIRONMENTS.join(', ')}`,
    );
  }

  const environment = nodeEnv as NodeEnvironment;
  const paymentProvider = readString(config, 'PAYMENT_PROVIDER', 'mock');

  if (!VALID_PAYMENT_PROVIDERS.includes(paymentProvider as PaymentProvider)) {
    throw new Error(
      `PAYMENT_PROVIDER must be one of: ${VALID_PAYMENT_PROVIDERS.join(', ')}`,
    );
  }

  const baseUrl = readString(config, 'BASE_URL', '');

  const accessTokenSecret = readString(
    config,
    'JWT_ACCESS_TOKEN_SECRET',
    'change-me-access-secret',
  );
  const refreshTokenSecret = readString(
    config,
    'JWT_REFRESH_TOKEN_SECRET',
    'change-me-refresh-secret',
  );
  const bvnEncryptionKey = readString(
    config,
    'BVN_ENCRYPTION_KEY',
    'local-development-bvn-key-change-me',
  );
  const africasTalkingApiKey = readString(
    config,
    'AFRICAS_TALKING_API_KEY',
    '',
  );
  const africasTalkingBaseUrl = readString(
    config,
    'AFRICAS_TALKING_BASE_URL',
    'https://api.africastalking.com',
  );
  const africasTalkingSenderId = readString(
    config,
    'AFRICAS_TALKING_SENDER_ID',
    '',
  );
  const africasTalkingUsername = readString(
    config,
    'AFRICAS_TALKING_USERNAME',
    '',
  );

  const resendApiKey = readString(config, 'RESEND_API_KEY', '');
  const resendFromEmail = readString(config, 'RESEND_FROM_EMAIL', '');

  for (const [key, value] of [
    ['AFRICAS_TALKING_BASE_URL', africasTalkingBaseUrl],
    ['BASE_URL', baseUrl],
  ] as const) {
    try {
      new URL(value);
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
  }

  if (environment === 'production') {
    for (const [key, value] of [
      ['JWT_ACCESS_TOKEN_SECRET', accessTokenSecret],
      ['JWT_REFRESH_TOKEN_SECRET', refreshTokenSecret],
      ['BVN_ENCRYPTION_KEY', bvnEncryptionKey],
    ] as const) {
      if (value.startsWith('change-me') || value.includes('development')) {
        throw new Error(`${key} must be configured for production`);
      }
    }

    if (resendApiKey === '' || resendApiKey === 'resend-api-key') {
      throw new Error('RESEND_API_KEY must be configured for production');
    }

    if (
      africasTalkingApiKey === '' ||
      africasTalkingApiKey === 'africas-talking-api-key'
    ) {
      throw new Error(
        'AFRICAS_TALKING_API_KEY must be configured for production',
      );
    }

    if (africasTalkingUsername === '') {
      throw new Error(
        'AFRICAS_TALKING_USERNAME must be configured for production',
      );
    }
  }

  return {
    BASE_URL: baseUrl,
    NODE_ENV: environment,
    PORT: readNumber(config, 'PORT', 3000),
    APP_NAME: readString(config, 'APP_NAME', 'tash-api'),
    API_PREFIX: readString(config, 'API_PREFIX', 'api/v1'),
    CORS_ORIGINS: readStringList(config, 'CORS_ORIGINS'),
    DATABASE_HOST: readString(config, 'DATABASE_HOST', 'localhost'),
    DATABASE_PORT: readNumber(config, 'DATABASE_PORT', 5432),
    DATABASE_USERNAME: readString(config, 'DATABASE_USERNAME', 'tash'),
    DATABASE_PASSWORD: readString(config, 'DATABASE_PASSWORD', 'tash'),
    DATABASE_NAME: readString(config, 'DATABASE_NAME', 'tash'),
    DATABASE_SSL: readBoolean(config, 'DATABASE_SSL', false),
    DATABASE_URL: readOptionalString(config, 'DATABASE_URL'),
    REDIS_URL: readString(config, 'REDIS_URL', 'redis://localhost:6379'),
    JWT_ACCESS_TOKEN_SECRET: accessTokenSecret,
    JWT_REFRESH_TOKEN_SECRET: refreshTokenSecret,
    JWT_ACCESS_TOKEN_TTL_SECONDS: readNumber(
      config,
      'JWT_ACCESS_TOKEN_TTL_SECONDS',
      15 * 60,
    ),
    JWT_REFRESH_TOKEN_TTL_SECONDS: readNumber(
      config,
      'JWT_REFRESH_TOKEN_TTL_SECONDS',
      30 * 24 * 60 * 60,
    ),
    VERIFICATION_TOKEN_TTL_SECONDS: readNumber(
      config,
      'VERIFICATION_TOKEN_TTL_SECONDS',
      24 * 60 * 60,
    ),
    PASSWORD_RESET_TOKEN_TTL_SECONDS: readNumber(
      config,
      'PASSWORD_RESET_TOKEN_TTL_SECONDS',
      30 * 60,
    ),
    BVN_ENCRYPTION_KEY: bvnEncryptionKey,
    TRANSACTION_PIN_MAX_ATTEMPTS: readNumber(
      config,
      'TRANSACTION_PIN_MAX_ATTEMPTS',
      5,
    ),
    TRANSACTION_PIN_LOCK_MINUTES: readNumber(
      config,
      'TRANSACTION_PIN_LOCK_MINUTES',
      15,
    ),
    PAYMENT_PROVIDER: paymentProvider as PaymentProvider,
    AFRICAS_TALKING_API_KEY: africasTalkingApiKey,
    AFRICAS_TALKING_BASE_URL: africasTalkingBaseUrl,
    AFRICAS_TALKING_SENDER_ID: africasTalkingSenderId,
    AFRICAS_TALKING_USERNAME: africasTalkingUsername,
    SKIP_EXTERNAL_CONNECTIONS: readBoolean(
      config,
      'SKIP_EXTERNAL_CONNECTIONS',
      environment === 'test',
    ),
    RESEND_API_KEY: resendApiKey,
    RESEND_FROM_EMAIL: resendFromEmail,
  };
}
