import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardsModule } from '../cards/cards.module';
import { DirectDebitModule } from '../direct-debit/direct-debit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PayWithTashSession } from './entities/pay-with-tash-session.entity';
import {
  MerchantPayWithTashController,
  PayWithTashController,
} from './pay-with-tash.controller';
import { PayWithTashService } from './pay-with-tash.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayWithTashSession]),
    CardsModule,
    DirectDebitModule,
    IdempotencyModule,
    MerchantsModule,
    PaymentProvidersModule,
    SettingsModule,
    TransactionsModule,
    WalletsModule,
  ],
  controllers: [PayWithTashController, MerchantPayWithTashController],
  providers: [PayWithTashService],
  exports: [PayWithTashService, TypeOrmModule],
})
export class PayWithTashModule {}
