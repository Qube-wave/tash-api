import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  CreateMerchantApiKeyDto,
  CreateMerchantDto,
  UpdateMerchantDto,
  UpdateMerchantSettingsDto,
} from './dto/merchant.dto';
import {
  CreatedMerchantApiKeyResponse,
  MerchantApiKeyResponse,
  MerchantResponse,
  MerchantSettingsResponse,
  MerchantsService,
} from './merchants.service';

@ApiTags('merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMerchantDto,
  ): Promise<MerchantResponse> {
    return this.merchantsService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<MerchantResponse> {
    return this.merchantsService.getMine(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMerchantDto,
  ): Promise<MerchantResponse> {
    return this.merchantsService.updateMine(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/settings')
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MerchantSettingsResponse> {
    return this.merchantsService.getSettingsResponse(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMerchantSettingsDto,
  ): Promise<MerchantSettingsResponse> {
    return this.merchantsService.updateSettings(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/webhook-secret/rotate')
  rotateWebhookSecret(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ webhookSecret: string }> {
    return this.merchantsService.rotateWebhookSecret(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/api-keys')
  createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMerchantApiKeyDto,
  ): Promise<CreatedMerchantApiKeyResponse> {
    return this.merchantsService.createApiKey(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/api-keys')
  listApiKeys(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MerchantApiKeyResponse[]> {
    return this.merchantsService.listApiKeys(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me/api-keys/:uuid')
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<{ revoked: true }> {
    await this.merchantsService.revokeApiKey(user.id, uuid);
    return { revoked: true };
  }

  @Get(':merchantCode')
  getByCode(
    @Param('merchantCode') merchantCode: string,
  ): Promise<MerchantResponse> {
    return this.merchantsService.getPublicByCode(merchantCode);
  }
}
