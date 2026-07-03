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
  DirectDebitFundingResponse,
  DirectDebitFundingService,
} from './direct-debit-funding.service';
import { FundWalletWithDirectDebitDto } from './dto/direct-debit.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets/:walletUuid/fund/direct-debit')
export class DirectDebitFundingController {
  constructor(
    private readonly fundingService: DirectDebitFundingService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  async fundWithDirectDebit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('walletUuid') walletUuid: string,
    @Body() dto: FundWalletWithDirectDebitDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<DirectDebitFundingResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: 'POST /wallets/:walletUuid/fund/direct-debit',
      idempotencyKey,
      requestBody: { walletUuid, ...dto },
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.fundingService.fundWalletWithDirectDebit(
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
