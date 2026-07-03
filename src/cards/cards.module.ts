import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CardFundingController } from './card-funding.controller';
import { CardFundingService } from './card-funding.service';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CardRegistrationSession } from './entities/card-registration-session.entity';
import { Card } from './entities/card.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card, CardRegistrationSession]),
    IdempotencyModule,
    PaymentProvidersModule,
    SettingsModule,
    TransactionsModule,
    UsersModule,
    WalletsModule,
  ],
  controllers: [CardsController, CardFundingController],
  providers: [CardsService, CardFundingService],
  exports: [CardsService, TypeOrmModule],
})
export class CardsModule {}
