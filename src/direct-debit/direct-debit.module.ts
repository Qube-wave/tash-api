import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { DirectDebitFundingController } from './direct-debit-funding.controller';
import { DirectDebitFundingService } from './direct-debit-funding.service';
import { DirectDebitController } from './direct-debit.controller';
import { DirectDebitService } from './direct-debit.service';
import { DirectDebitMandate } from './entities/direct-debit-mandate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DirectDebitMandate]),
    IdempotencyModule,
    PaymentProvidersModule,
    SettingsModule,
    TransactionsModule,
    UsersModule,
    WalletsModule,
  ],
  controllers: [DirectDebitController, DirectDebitFundingController],
  providers: [DirectDebitService, DirectDebitFundingService],
  exports: [DirectDebitService, TypeOrmModule],
})
export class DirectDebitModule {}
