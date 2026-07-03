import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { UpdatePaymentTagDto } from './dto/update-payment-tag.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  PublicUserProfile,
  ResolvedRecipient,
  UsersService,
} from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<PublicUserProfile> {
    return this.usersService.getPublicProfile(user.uuid);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUserProfile> {
    return this.usersService.updateProfile(user.uuid, dto);
  }

  @Patch('me/tag')
  updatePaymentTag(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePaymentTagDto,
  ): Promise<PublicUserProfile> {
    return this.usersService.updatePaymentTag(user.uuid, dto.paymentTag);
  }

  @Get('resolve/:recipient')
  resolveRecipient(
    @Param('recipient') recipient: string,
  ): Promise<ResolvedRecipient> {
    return this.usersService.resolveRecipient(recipient);
  }
}
