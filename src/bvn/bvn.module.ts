import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../common/crypto/crypto.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { UsersModule } from '../users/users.module';
import { BvnController } from './bvn.controller';
import { BvnService } from './bvn.service';
import { BvnProfile } from './entities/bvn-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BvnProfile]),
    CryptoModule,
    PaymentProvidersModule,
    UsersModule,
  ],
  controllers: [BvnController],
  providers: [BvnService],
  exports: [BvnService],
})
export class BvnModule {}
