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
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { CurrentMerchant } from '../merchants/current-merchant.decorator';
import { MerchantApiKeyGuard } from '../merchants/guards/merchant-api-key.guard';
import type { AuthenticatedMerchant } from '../merchants/merchant-authenticated';
import { TransactionResponse } from '../transactions/transactions.service';
import {
  AuthorizePayWithTashSessionDto,
  CreatePayWithTashSessionDto,
} from './dto/pay-with-tash.dto';
import {
  PayWithTashService,
  PayWithTashSessionResponse,
} from './pay-with-tash.service';

@ApiTags('pay-with-tash')
@Controller('pay-with-tash/sessions')
export class PayWithTashController {
  constructor(
    private readonly payWithTashService: PayWithTashService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(MerchantApiKeyGuard)
  @Post()
  async createSession(
    @CurrentMerchant() auth: AuthenticatedMerchant,
    @Body() dto: CreatePayWithTashSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<PayWithTashSessionResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startMerchantRequest({
      merchantId: auth.merchant.id,
      route: 'POST /pay-with-tash/sessions',
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.payWithTashService.createSession(
        auth.merchant,
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

  @Get(':reference')
  getSession(
    @Param('reference') reference: string,
  ): Promise<PayWithTashSessionResponse> {
    return this.payWithTashService.getPublicSession(reference);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':reference/authorize')
  async authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: AuthorizePayWithTashSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<PayWithTashSessionResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: `POST /pay-with-tash/sessions/${reference}/authorize`,
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.payWithTashService.authorize(
        user.id,
        reference,
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':reference/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
  ): Promise<PayWithTashSessionResponse> {
    return this.payWithTashService.cancel(user.id, reference);
  }

  @Get(':reference/status')
  getStatus(
    @Param('reference') reference: string,
  ): Promise<PayWithTashSessionResponse> {
    return this.payWithTashService.getPublicSession(reference);
  }
}

@ApiTags('merchant pay-with-tash')
@ApiBearerAuth()
@UseGuards(MerchantApiKeyGuard)
@Controller('merchants/me')
export class MerchantPayWithTashController {
  constructor(private readonly payWithTashService: PayWithTashService) {}

  @Get('pay-with-tash/sessions/:reference')
  getMerchantSession(
    @CurrentMerchant() auth: AuthenticatedMerchant,
    @Param('reference') reference: string,
  ): Promise<PayWithTashSessionResponse> {
    return this.payWithTashService.getMerchantSession(
      auth.merchant.id,
      reference,
    );
  }

  @Get('transactions')
  listMerchantTransactions(
    @CurrentMerchant() auth: AuthenticatedMerchant,
  ): Promise<TransactionResponse[]> {
    return this.payWithTashService.listMerchantTransactions(auth.merchant.id);
  }
}
