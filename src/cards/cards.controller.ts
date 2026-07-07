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
  CardsService,
  CardRegistrationSessionResponse,
  CardResponse,
} from './cards.service';
import {
  CompleteCardRegistrationDto,
  CreateCardRegistrationSessionDto,
  SubmitCardDetailsDto,
  SubmitCardOtpDto,
} from './dto/card-registration.dto';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post('registration-sessions')
  createRegistrationSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCardRegistrationSessionDto,
  ): Promise<CardRegistrationSessionResponse> {
    return this.cardsService.createRegistrationSession(user.uuid, dto);
  }

  @Post('registration-sessions/:reference/card')
  submitRegistrationCardDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: SubmitCardDetailsDto,
  ): Promise<CardRegistrationSessionResponse> {
    return this.cardsService.submitRegistrationCardDetails(
      user.uuid,
      reference,
      dto,
    );
  }

  @Post('registration-sessions/:reference/otp')
  submitRegistrationCardOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: SubmitCardOtpDto,
  ): Promise<CardResponse> {
    return this.cardsService.submitRegistrationCardOtp(
      user.uuid,
      reference,
      dto,
    );
  }

  @Post('registration-sessions/:reference/resend-otp')
  resendRegistrationCardOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
  ): Promise<CardRegistrationSessionResponse> {
    return this.cardsService.resendRegistrationCardOtp(user.uuid, reference);
  }

  @Post('registration-sessions/:reference/complete')
  completeRegistrationSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() _dto: CompleteCardRegistrationDto,
  ): Promise<CardResponse> {
    void _dto;
    return this.cardsService.completeRegistrationSession(user.uuid, reference);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CardResponse[]> {
    return this.cardsService.listForUser(user.id);
  }

  @Get(':uuid')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<CardResponse> {
    return this.cardsService.getResponseForUser(user.id, uuid);
  }

  @Patch(':uuid/default')
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<CardResponse> {
    return this.cardsService.setDefault(user.id, uuid);
  }

  @Post(':uuid/disable')
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<CardResponse> {
    return this.cardsService.disable(user.id, uuid);
  }

  @Delete(':uuid')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ): Promise<{ deleted: true }> {
    await this.cardsService.delete(user.id, uuid);
    return { deleted: true };
  }
}
