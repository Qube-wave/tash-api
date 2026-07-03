import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ListTransactionsQuery } from './dto/list-transactions.query';
import {
  TransactionResponse,
  TransactionsService,
} from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQuery,
  ): Promise<{ items: TransactionResponse[]; nextCursor: string | null }> {
    return this.transactionsService.listForUser(user.id, query);
  }

  @Get(':uuid')
  getByUuid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<TransactionResponse> {
    return this.transactionsService.getForUser(user.id, uuid);
  }

  @Get('reference/:reference')
  getByReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
  ): Promise<TransactionResponse> {
    return this.transactionsService.getByReferenceForUser(user.id, reference);
  }
}
