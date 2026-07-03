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
import {
  TransactionResponse,
  TransactionsService,
} from '../transactions/transactions.service';
import { CreateBankTransferDto } from './dto/create-bank-transfer.dto';
import { CreateTashTransferDto } from './dto/create-tash-transfer.dto';
import {
  BankTransferResponse,
  TashTransferResponse,
  TransfersService,
} from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly idempotencyService: IdempotencyService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Post('tash')
  async createTashTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTashTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<TashTransferResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: 'POST /transfers/tash',
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.transfersService.createTashTransfer(
        user.id,
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

  @Post('bank')
  async createBankTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBankTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<BankTransferResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: 'POST /transfers/bank',
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.transfersService.createBankTransfer(
        user.id,
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
  getTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
  ): Promise<TransactionResponse> {
    return this.transactionsService.getByReferenceForUser(user.id, reference);
  }
}
