import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import paymentProviderConfig from './payment-provider.config';
import redisConfig from './redis.config';
import securityConfig from './security.config';

export const configuration = [
  appConfig,
  authConfig,
  databaseConfig,
  paymentProviderConfig,
  redisConfig,
  securityConfig,
];
