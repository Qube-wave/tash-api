import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { AdminGuard } from '../common/auth/admin.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { CurrentMerchant } from '../merchants/current-merchant.decorator';
import { MerchantApiKeyGuard } from '../merchants/guards/merchant-api-key.guard';
import type { AuthenticatedMerchant } from '../merchants/merchant-authenticated';
import { CreateRefundDto, RefundResponse } from './dto/refund.dto';
import { RefundsService } from './refunds.service';

@ApiTags('refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('refunds')
export class ConsumerRefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RefundResponse[]> {
    return this.refundsService.listForUser(user.id);
  }

  @Get(':uuid')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<RefundResponse> {
    return this.refundsService.getForUser(user.id, uuid);
  }
}

@ApiTags('merchant refunds')
@ApiBearerAuth()
@UseGuards(MerchantApiKeyGuard)
@Controller('merchants/me')
export class MerchantRefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('transactions/:transactionUuid/refunds')
  async create(
    @CurrentMerchant() auth: AuthenticatedMerchant,
    @Param('transactionUuid') transactionUuid: string,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<RefundResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startMerchantRequest({
      merchantId: auth.merchant.id,
      route: `POST /merchants/me/transactions/${transactionUuid}/refunds`,
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.refundsService.createMerchantRefund(
        auth.merchant.id,
        transactionUuid,
        dto,
      );
      await this.idempotencyService.complete(
        idempotency.record,
        response as unknown as Record<string, unknown>,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(idempotency.record);
      throw error;
    }
  }

  @Get('refunds')
  list(
    @CurrentMerchant() auth: AuthenticatedMerchant,
  ): Promise<RefundResponse[]> {
    return this.refundsService.listForMerchant(auth.merchant.id);
  }

  @Get('refunds/:uuid')
  get(
    @CurrentMerchant() auth: AuthenticatedMerchant,
    @Param('uuid') uuid: string,
  ): Promise<RefundResponse> {
    return this.refundsService.getForMerchant(auth.merchant.id, uuid);
  }
}

@ApiTags('admin refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/transactions')
export class AdminRefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post(':transactionUuid/refunds')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionUuid') transactionUuid: string,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<RefundResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: `POST /admin/transactions/${transactionUuid}/refunds`,
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.refundsService.createAdminRefund(
        user.id,
        transactionUuid,
        dto,
      );
      await this.idempotencyService.complete(
        idempotency.record,
        response as unknown as Record<string, unknown>,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(idempotency.record);
      throw error;
    }
  }
}
