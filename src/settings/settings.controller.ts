import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  CreateTransactionPinDto,
  UpdateTransactionPinDto,
} from './dto/transaction-pin.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { PaymentSettingsResponse, SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('payment')
  getPaymentSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentSettingsResponse> {
    return this.settingsService.getPaymentSettings(user.id);
  }

  @Patch('payment')
  updatePaymentSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponse> {
    return this.settingsService.updatePaymentSettings(user.id, dto);
  }

  @Post('transaction-pin')
  async createTransactionPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionPinDto,
  ): Promise<{ created: true }> {
    await this.settingsService.createTransactionPin(user.id, dto.pin);
    return { created: true };
  }

  @Patch('transaction-pin')
  async updateTransactionPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTransactionPinDto,
  ): Promise<{ updated: true }> {
    await this.settingsService.updateTransactionPin(
      user.id,
      dto.currentPin,
      dto.newPin,
    );
    return { updated: true };
  }
}
