import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from '../transactions/transactions.module';
import { VirtualAccountsModule } from '../virtual-accounts/virtual-accounts.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    TransactionsModule,
    VirtualAccountsModule,
    WalletsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService, TypeOrmModule],
})
export class WebhooksModule {}
