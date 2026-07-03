import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { RedisConfiguration } from '../config/redis.config';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessStatus extends HealthStatus {
  checks: {
    database: 'ok' | 'skipped' | 'unavailable';
    redis: 'ok' | 'skipped' | 'unavailable';
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  getLiveness(): HealthStatus {
    return {
      status: 'ok',
      service: this.configService.get<string>('app.name', 'tash-api'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const skipExternalConnections = this.configService.get<boolean>(
      'app.skipExternalConnections',
      false,
    );

    if (skipExternalConnections) {
      return {
        ...this.getLiveness(),
        checks: {
          database: 'skipped',
          redis: 'skipped',
        },
      };
    }

    return {
      ...this.getLiveness(),
      checks: {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      },
    };
  }

  private async checkDatabase(): Promise<'ok' | 'unavailable'> {
    if (this.dataSource === undefined || !this.dataSource.isInitialized) {
      return 'unavailable';
    }

    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  private async checkRedis(): Promise<'ok' | 'unavailable'> {
    const redisConfig =
      this.configService.getOrThrow<RedisConfiguration>('redis');
    const client = new Redis(redisConfig.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      const response = await client.ping();
      return response === 'PONG' ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      client.disconnect();
    }
  }
}
