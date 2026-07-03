import { DataSource, DataSourceOptions } from 'typeorm';

const sslEnabled = process.env.DATABASE_SSL === 'true';

const baseOptions: DataSourceOptions = {
  type: 'postgres',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  migrationsRun: false,
  logging: false,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
};

const options: DataSourceOptions =
  process.env.DATABASE_URL !== undefined
    ? {
        ...baseOptions,
        url: process.env.DATABASE_URL,
      }
    : {
        ...baseOptions,
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        username: process.env.DATABASE_USERNAME ?? 'tash',
        password: process.env.DATABASE_PASSWORD ?? 'tash',
        database: process.env.DATABASE_NAME ?? 'tash',
      };

export default new DataSource(options);
