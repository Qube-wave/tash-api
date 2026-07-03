import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WalletLedgerEntry } from './entities/wallet-ledger-entry.entity';
import { WalletResponse } from './dto/wallet-response.dto';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<WalletResponse[]> {
    return this.walletsService.listForUser(user.id);
  }

  @Get(':uuid')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<WalletResponse> {
    return this.walletsService.getResponseForUser(user.id, uuid);
  }

  @Get(':uuid/balance')
  getBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<WalletResponse> {
    return this.walletsService.getBalance(user.id, uuid);
  }

  @Get(':uuid/transactions')
  listLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<WalletLedgerEntry[]> {
    return this.walletsService.listLedgerForUser(user.id, uuid);
  }
}
