import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { BanksController } from './banks.controller';
import { BanksService } from './banks.service';

@Module({
  imports: [PaymentProvidersModule],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService],
})
export class BanksModule {}
