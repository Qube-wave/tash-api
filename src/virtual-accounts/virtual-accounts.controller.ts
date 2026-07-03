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
import { CreateVirtualAccountDto } from './dto/virtual-account.dto';
import {
  VirtualAccountResponse,
  VirtualAccountsService,
} from './virtual-accounts.service';

@ApiTags('virtual-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('virtual-accounts')
export class VirtualAccountsController {
  constructor(
    private readonly virtualAccountsService: VirtualAccountsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVirtualAccountDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<VirtualAccountResponse | Record<string, unknown>> {
    const idempotency = await this.idempotencyService.startConsumerRequest({
      userId: user.id,
      route: 'POST /virtual-accounts',
      idempotencyKey,
      requestBody: dto,
    });

    if (idempotency.replayResponse !== null) {
      return idempotency.replayResponse;
    }

    try {
      const response = await this.virtualAccountsService.create(
        user.uuid,
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

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VirtualAccountResponse[]> {
    return this.virtualAccountsService.listForUser(user.id);
  }

  @Get(':uuid')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<VirtualAccountResponse> {
    return this.virtualAccountsService.getResponseForUser(user.id, uuid);
  }

  @Post(':uuid/disable')
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<VirtualAccountResponse> {
    return this.virtualAccountsService.disable(user.id, uuid);
  }
}
