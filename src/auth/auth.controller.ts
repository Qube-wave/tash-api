import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  CompleteEmailVerificationDto,
  CompleteOnboardingPinDto,
  CompleteOnboardingProfileDto,
  CompleteOnboardingTagDto,
  CompletePhoneVerificationDto,
  RefreshTokenDto,
  UnlockDto,
  VerifyEmailDto,
  VerifyPhoneNumberDto,
} from './dto/auth.dto';
import {
  AuthResponse,
  AuthService,
  AuthTokens,
  OnboardingSessionResponse,
  OnboardingStepResponse,
} from './auth.service';

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
  completePhoneVerification(
    @Body() dto: CompletePhoneVerificationDto,
  ): Promise<OnboardingSessionResponse> {
    return this.authService.completePhoneVerification(dto);
  }

  @Post('send-email-verification')
  sendEmailVerification(@Body() dto: VerifyEmailDto) {
    return this.authService.sendEmailVerification(dto);
  }

  @Post('complete-email-verification')
  completeEmailVerification(
    @Body() dto: CompleteEmailVerificationDto,
  ): Promise<OnboardingSessionResponse> {
    return this.authService.completeEmailVerification(dto);
  }

  @Post('onboarding/profile')
  completeOnboardingProfile(
    @Body() dto: CompleteOnboardingProfileDto,
  ): Promise<OnboardingStepResponse> {
    return this.authService.completeOnboardingProfile(dto);
  }

  @Post('onboarding/tag')
  completeOnboardingTag(
    @Body() dto: CompleteOnboardingTagDto,
  ): Promise<OnboardingStepResponse> {
    return this.authService.completeOnboardingTag(dto);
  }

  @Post('onboarding/pin')
  completeOnboardingPin(
    @Body() dto: CompleteOnboardingPinDto,
  ): Promise<AuthResponse> {
    return this.authService.completeOnboardingPin(dto);
  }

  @Post('login/phone/send-verification')
  sendLoginPhoneVerification(
    @Body() dto: VerifyPhoneNumberDto,
  ): Promise<{ message: string }> {
    return this.authService.sendLoginPhoneVerification(dto);
  }

  @Post('login/phone/complete-verification')
  completeLoginPhoneVerification(
    @Body() dto: CompletePhoneVerificationDto,
  ): Promise<AuthResponse> {
    return this.authService.completeLoginPhoneVerification(dto);
  }

  @Post('login/email/send-verification')
  sendLoginEmailVerification(
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    return this.authService.sendLoginEmailVerification(dto);
  }

  @Post('login/email/complete-verification')
  completeLoginEmailVerification(
    @Body() dto: CompleteEmailVerificationDto,
  ): Promise<AuthResponse> {
    return this.authService.completeLoginEmailVerification(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  @Post('unlock')
  unlock(@Body() dto: UnlockDto): Promise<AuthResponse> {
    return this.authService.unlock(dto);
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
}
