import {
  Body,
  Controller,
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
import {
  CardFundingResponse,
  CardFundingService,
} from './card-funding.service';
import { FundWalletWithCardDto } from './dto/card-funding.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets/:walletUuid/fund/card')
export class CardFundingController {
  constructor(
    private readonly cardFundingService: CardFundingService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  async fundWithCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('walletUuid') walletUuid: string,
    @Body() dto: FundWalletWithCardDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<CardFundingResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: 'POST /wallets/:walletUuid/fund/card',
      idempotencyKey,
      requestBody: { walletUuid, ...dto },
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.cardFundingService.fundWalletWithCard(
        user.id,
        walletUuid,
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
