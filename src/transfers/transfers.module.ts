import { Module } from '@nestjs/common';
import { BanksModule } from '../banks/banks.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [
    BanksModule,
    IdempotencyModule,
    PaymentProvidersModule,
    SettingsModule,
    TransactionsModule,
    UsersModule,
    WalletsModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
