import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { MERCHANT_WEBHOOK_QUEUE } from '../jobs/job-names';
import { MerchantApiKey } from './entities/merchant-api-key.entity';
import { MerchantCustomer } from './entities/merchant-customer.entity';
import { MerchantSettings } from './entities/merchant-settings.entity';
import { MerchantWebhookDelivery } from './entities/merchant-webhook-delivery.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { MerchantWebhookProcessor } from './merchant-webhook.processor';
import { MerchantWebhookService } from './merchant-webhook.service';
import { MerchantApiKeyGuard } from './guards/merchant-api-key.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: MERCHANT_WEBHOOK_QUEUE }),
    TypeOrmModule.forFeature([
      Merchant,
      MerchantSettings,
      MerchantApiKey,
      MerchantCustomer,
      MerchantWebhookDelivery,
    ]),
    AuditLogsModule,
    CryptoModule,
  ],
  controllers: [MerchantsController],
  providers: [
    MerchantsService,
    MerchantWebhookService,
    MerchantWebhookProcessor,
    MerchantApiKeyGuard,
  ],
  exports: [
    MerchantsService,
    MerchantWebhookService,
    MerchantApiKeyGuard,
    TypeOrmModule,
  ],
})
export class MerchantsModule {}
