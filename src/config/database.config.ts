import { registerAs } from '@nestjs/config';

export interface DatabaseConfiguration {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  ssl: boolean;
}

export default registerAs('database', (): DatabaseConfiguration => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME ?? 'tash',
  password: process.env.DATABASE_PASSWORD ?? 'tash',
  name: process.env.DATABASE_NAME ?? 'tash',
  ssl: process.env.DATABASE_SSL === 'true',
}));
