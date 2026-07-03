import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  AuthorizeDirectDebitMandateDto,
  CreateDirectDebitMandateDto,
  RevokeDirectDebitMandateDto,
} from './dto/direct-debit.dto';
import {
  DirectDebitMandateResponse,
  DirectDebitService,
} from './direct-debit.service';

@ApiTags('direct-debit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('direct-debit')
export class DirectDebitController {
  constructor(private readonly directDebitService: DirectDebitService) {}

  @Post('mandates')
  createMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.createMandate(user.uuid, dto);
  }

  @Get('mandates')
  listMandates(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DirectDebitMandateResponse[]> {
    return this.directDebitService.listForUser(user.id);
  }

  @Get('mandates/:uuid')
  getMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.getResponseForUser(user.id, uuid);
  }

  @Post('mandates/:uuid/authorize')
  authorizeMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() dto: AuthorizeDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.authorize(user.id, uuid, dto);
  }

  @Post('mandates/:uuid/revoke')
  revokeMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() _dto: RevokeDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    void _dto;
    return this.directDebitService.revoke(user.id, uuid);
  }
}
