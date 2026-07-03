import { registerAs } from '@nestjs/config';

export interface RedisConfiguration {
  url: string;
}

export default registerAs('redis', (): RedisConfiguration => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));
