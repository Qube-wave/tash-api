import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisOptions } from 'ioredis';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { configuration } from './config';
import { DatabaseConfiguration } from './config/database.config';
import { validateEnvironment } from './config/environment';
import { RedisConfiguration } from './config/redis.config';
import { createTypeOrmOptions } from './database/typeorm-options.factory';
import { AuthModule } from './auth/auth.module';
import { BanksModule } from './banks/banks.module';
import { BvnModule } from './bvn/bvn.module';
import { CardsModule } from './cards/cards.module';
import { DirectDebitModule } from './direct-debit/direct-debit.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { JobsModule } from './jobs/jobs.module';
import { MerchantsModule } from './merchants/merchants.module';
import { PaymentProvidersModule } from './payment-providers/payment-providers.module';
import { RefundsModule } from './refunds/refunds.module';
import { PayWithTashModule } from './pay-with-tash/pay-with-tash.module';
import { SettingsModule } from './settings/settings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { UsersModule } from './users/users.module';
import { VirtualAccountsModule } from './virtual-accounts/virtual-accounts.module';
import { WalletsModule } from './wallets/wallets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

function externalConnectionsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'test' &&
    process.env.SKIP_EXTERNAL_CONNECTIONS !== 'true'
  );
}

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

const externalImports = externalConnectionsEnabled()
  ? [
      TypeOrmModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createTypeOrmOptions(
            configService.getOrThrow<DatabaseConfiguration>('database'),
          ),
      }),
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: parseRedisUrl(
            configService.getOrThrow<RedisConfiguration>('redis').url,
          ),
        }),
      }),
    ]
  : [];

const featureImports = externalConnectionsEnabled()
  ? [
      PaymentProvidersModule,
      UsersModule,
      SettingsModule,
      AuthModule,
      BanksModule,
      BvnModule,
      CardsModule,
      DirectDebitModule,
      TransactionsModule,
      WalletsModule,
      VirtualAccountsModule,
      WebhooksModule,
      IdempotencyModule,
      TransfersModule,
      MerchantsModule,
      PayWithTashModule,
      RefundsModule,
      JobsModule,
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      validate: validateEnvironment,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),
    ...externalImports,
    CommonModule,
    HealthModule,
    ...featureImports,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
