import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { VirtualAccount } from './entities/virtual-account.entity';
import { VirtualAccountsController } from './virtual-accounts.controller';
import { VirtualAccountsService } from './virtual-accounts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualAccount]),
    IdempotencyModule,
    PaymentProvidersModule,
    UsersModule,
    WalletsModule,
  ],
  controllers: [VirtualAccountsController],
  providers: [VirtualAccountsService],
  exports: [VirtualAccountsService, TypeOrmModule],
})
export class VirtualAccountsModule {}
