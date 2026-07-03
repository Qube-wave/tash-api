import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseConfiguration } from '../config/database.config';

export function createTypeOrmOptions(
  config: DatabaseConfiguration,
): TypeOrmModuleOptions {
  const baseOptions: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    migrations: ['dist/database/migrations/*.js'],
    logging: false,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  };

  if (config.url !== undefined) {
    return {
      ...baseOptions,
      url: config.url,
    };
  }

  return {
    ...baseOptions,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.name,
  };
}
