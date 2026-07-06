import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from '../cards/entities/card.entity';
import { CryptoModule } from '../common/crypto/crypto.module';
import { DirectDebitMandate } from '../direct-debit/entities/direct-debit-mandate.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { TransactionPin } from './entities/transaction-pin.entity';
import { UserPaymentSettings } from './entities/user-payment-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserPaymentSettings,
      TransactionPin,
      Card,
      DirectDebitMandate,
      Wallet,
    ]),
    CryptoModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService, TypeOrmModule],
})
export class SettingsModule {}
