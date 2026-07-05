import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  ChangePasswordDto,
  CompletePhoneVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  VerifyPhoneNumberDto,
} from './dto/auth.dto';
import { AuthResponse, AuthService, AuthTokens } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-phone-verification')
  sendPhoneVerification(
    @Body() dto: VerifyPhoneNumberDto,
  ): Promise<{ message: string }> {
    return this.authService.sendPhoneVerification(dto);
  }

  @Post('complete-phone-verification')
  completePhoneVerification(@Body() dto: CompletePhoneVerificationDto) {
    return this.authService.completePhoneVerification(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ loggedOut: true }> {
    await this.authService.logout(user.id, dto.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ loggedOut: true }> {
    await this.authService.logoutAll(user.id);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('email/verify')
  async verifyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyEmailDto,
  ): Promise<{ verified: true }> {
    await this.authService.verifyEmail(user, dto);
    return { verified: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('phone/verify')
  async verifyPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPhoneDto,
  ): Promise<{ verified: true }> {
    await this.authService.verifyPhone(user, dto);
    return { verified: true };
  }

  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ accepted: true }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ reset: true }> {
    await this.authService.resetPassword(dto);
    return { reset: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    await this.authService.changePassword(user.id, dto);
    return { changed: true };
  }
}
