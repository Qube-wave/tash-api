import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { Refund } from './entities/refund.entity';
import {
  AdminRefundsController,
  ConsumerRefundsController,
  MerchantRefundsController,
} from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund]),
    AuditLogsModule,
    IdempotencyModule,
    MerchantsModule,
    PaymentProvidersModule,
    TransactionsModule,
    WalletsModule,
  ],
  controllers: [
    ConsumerRefundsController,
    MerchantRefundsController,
    AdminRefundsController,
  ],
  providers: [RefundsService],
  exports: [RefundsService, TypeOrmModule],
})
export class RefundsModule {}
