import { registerAs } from '@nestjs/config';
import { EnvironmentVariables } from './environment';

export interface AppConfiguration {
  name: string;
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  skipExternalConnections: boolean;
}

export default registerAs('app', (): AppConfiguration => ({
  name: process.env.APP_NAME ?? 'tash-api',
  nodeEnv: (process.env.NODE_ENV ??
    'development') as EnvironmentVariables['NODE_ENV'],
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins:
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? [],
  skipExternalConnections:
    process.env.SKIP_EXTERNAL_CONNECTIONS === 'true' ||
    process.env.NODE_ENV === 'test',
}));
