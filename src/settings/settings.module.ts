import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../common/crypto/crypto.module';
import { UsersModule } from '../users/users.module';
import { TransactionPin } from './entities/transaction-pin.entity';
import { UserPaymentSettings } from './entities/user-payment-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPaymentSettings, TransactionPin]),
    CryptoModule,
    UsersModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService, TypeOrmModule],
})
export class SettingsModule {}
