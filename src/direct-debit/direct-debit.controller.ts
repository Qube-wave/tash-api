import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @ApiOperation({
    summary: 'Create a reusable direct debit mandate',
    description:
      'Links a user bank account as a reusable direct debit mandate. If the provider returns requires_authorization, show metadata.authorizationDescription or metadata.authorizationSteps to the user before checking status.',
  })
  @Post('mandates')
  createMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.createMandate(user.uuid, dto);
  }

  @ApiOperation({ summary: 'List authenticated user direct debit mandates' })
  @Get('mandates')
  listMandates(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DirectDebitMandateResponse[]> {
    return this.directDebitService.listForUser(user.id);
  }

  @ApiOperation({ summary: 'Get a direct debit mandate by UUID' })
  @Get('mandates/:uuid')
  getMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.getResponseForUser(user.id, uuid);
  }

  @ApiOperation({
    summary: 'Check provider authorization status for a mandate',
    description:
      'Checks the provider status for an existing direct debit mandate. The bank details are not sent again; the endpoint uses the saved provider mandate ID and updates the local mandate status.',
  })
  @Post('mandates/:uuid/authorize')
  authorizeMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() dto: AuthorizeDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.authorize(user.id, uuid, dto);
  }

  @ApiOperation({ summary: 'Revoke a direct debit mandate' })
  @Post('mandates/:uuid/revoke')
  revokeMandate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() dto: RevokeDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    return this.directDebitService.revoke(user.id, uuid, dto.reason);
  }
}
