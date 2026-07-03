import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ProviderBankAccount } from '../payment-providers/interfaces/payment-provider.interface';
import { BankResponse, BanksService } from './banks.service';
import { ResolveAccountDto } from './dto/resolve-account.dto';

@ApiTags('banks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  listBanks(): BankResponse[] {
    return this.banksService.listBanks();
  }

  @Post('resolve-account')
  resolveAccount(@Body() dto: ResolveAccountDto): Promise<ProviderBankAccount> {
    return this.banksService.resolveAccount(dto);
  }
}
