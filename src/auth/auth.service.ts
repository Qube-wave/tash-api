import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  IsNull,
  LessThan,
  Repository,
} from 'typeorm';
import { AuthConfiguration } from '../config/auth.config';
import {
  AuthenticatedUser,
  JwtAccessTokenPayload,
  JwtRefreshTokenPayload,
} from '../common/auth/authenticated-user';
import { HashService } from '../common/crypto/hash.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { SettingsService } from '../settings/settings.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { PublicUserProfile, UsersService } from '../users/users.service';
import {
  ChangePasswordDto,
  CompletePhoneVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyEmailTokenDto,
  VerifyPhoneDto,
  VerifyPhoneNumberDto,
} from './dto/auth.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  VerificationToken,
  VerificationTokenType,
} from './entities/verification-token.entity';
import { OtpNotificationData } from 'src/notifications/notifications.interface';
import { NotificationsService } from 'src/notifications/notifications.service';

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokensRepository: Repository<VerificationToken>,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async sendPhoneVerification(
    dto: VerifyPhoneNumberDto,
  ): Promise<{ message: string }> {
    const { phoneNumber } = dto;

    const existingUser = await this.usersService.findByPhone(phoneNumber);
    if (existingUser) {
      throw new BadRequestException('User with phone number already exists');
    }

    const token =
      await this.createPhoneVerificationTokenWithPhoneNumber(phoneNumber);

    const smsOtpPayload: OtpNotificationData = {
      attempts: 5,
      length: 6,
      otp: token,
      phoneNumber,
      ttl: 15,
    };

    await this.notificationService.enqueuOtpSmsNotification(smsOtpPayload);

    return {
      message: 'A verification code has been sent to your phone',
    };
  }

  async completePhoneVerification(
    dto: CompletePhoneVerificationDto,
  ): Promise<{ message: string; isVerified: boolean }> {
    const { phoneNumber, token } = dto;

    await this.consumeVerificationToken(VerificationTokenType.Phone, token, {
      phoneNumber,
    });

    await this.usersService.createUserWithPhoneNumber(phoneNumber);

    return {
      message: 'Phone number verified successfully',
      isVerified: true,
    };
  }

  async sendEmailVerification(dto: VerifyEmailDto) {
    const { email } = dto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User with email already exists');
    }

    const token = await this.createPhoneVerificationTokenWithEmail(email);
  }

  // async register(dto: RegisterDto): Promise<AuthResponse> {
  //   const user = await this.usersService.createUser({
  //     email: dto.email,
  //     phoneNumber: dto.phoneNumber,
  //     paymentTag: dto.paymentTag,
  //     passwordHash: await this.hashService.hash(dto.password),
  //     firstName: dto.firstName,
  //     lastName: dto.lastName,
  //     dateOfBirth: dto.dateOfBirth,
  //     country: dto.country,
  //     defaultCurrency: dto.defaultCurrency,
  //   });
  //   await this.settingsService.createDefaults(user.id);
  //   await this.createVerificationToken(user.id, VerificationTokenType.Email);
  //   await this.createPhoneVerificationToken(user.id);

  //   return this.buildAuthResponse(user);
  // }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user === null) {
      throw this.invalidCredentials();
    }

    if (
      user.status === UserStatus.Suspended ||
      user.status === UserStatus.Disabled
    ) {
      throw new AppException(
        ErrorCode.AccountSuspended,
        'This account cannot sign in.',
        HttpStatus.FORBIDDEN,
      );
    }

    const validPassword = await this.hashService.verify(
      user.passwordHash!,
      dto.password,
    );
    if (!validPassword) {
      throw this.invalidCredentials();
    }

    await this.usersService.markLogin(user);
    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    let payload: JwtRefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshTokenPayload>(
        dto.refreshToken,
        { secret: auth.refreshTokenSecret },
      );
    } catch {
      throw this.invalidCredentials();
    }

    if (payload.typ !== 'refresh') {
      throw this.invalidCredentials();
    }

    const stored = await this.refreshTokensRepository.findOne({
      where: { tokenId: payload.jti },
    });
    if (
      stored === null ||
      stored.revokedAt !== null ||
      stored.expiresAt < new Date()
    ) {
      throw this.invalidCredentials();
    }

    const tokenMatches = await this.hashService.verify(
      stored.tokenHash,
      dto.refreshToken,
    );
    if (!tokenMatches) {
      throw this.invalidCredentials();
    }

    const user = await this.usersService.getByUuid(payload.sub);
    const replacement = await this.issueTokens(user);
    stored.revokedAt = new Date();
    stored.replacedByTokenId = await this.getRefreshTokenId(
      replacement.refreshToken,
    );
    await this.refreshTokensRepository.save(stored);

    return replacement;
  }

  async logout(userId: number, refreshToken: string): Promise<void> {
    const tokenId = await this.tryGetRefreshTokenId(refreshToken);
    if (tokenId === null) {
      return;
    }

    const token = await this.refreshTokensRepository.findOne({
      where: { tokenId, userId },
    });
    if (token !== null && token.revokedAt === null) {
      token.revokedAt = new Date();
      await this.refreshTokensRepository.save(token);
    }
  }

  async logoutAll(userId: number): Promise<void> {
    const activeTokens = await this.refreshTokensRepository.find({
      where: { userId, revokedAt: IsNull() },
    });

    for (const token of activeTokens) {
      token.revokedAt = new Date();
    }

    await this.refreshTokensRepository.save(activeTokens);
  }

  async verifyEmail(
    user: AuthenticatedUser,
    dto: VerifyEmailTokenDto,
  ): Promise<void> {
    await this.consumeVerificationToken(
      VerificationTokenType.Email,
      dto.token,
      { userId: user.id },
    );
    const entity = await this.usersService.getByUuid(user.uuid);
    await this.usersService.markEmailVerified(entity);
  }

  async verifyPhone(
    user: AuthenticatedUser,
    dto: VerifyPhoneDto,
  ): Promise<void> {
    await this.consumeVerificationToken(
      VerificationTokenType.Phone,
      dto.token,
      { userId: user.id },
    );
    const entity = await this.usersService.getByUuid(user.uuid);
    await this.usersService.markPhoneVerified(entity);
  }

  async forgotPassword(_dto: ForgotPasswordDto): Promise<{ accepted: true }> {
    const user = await this.usersService.findByEmail(_dto.email);
    if (user !== null) {
      await this.createVerificationToken(
        user.id,
        VerificationTokenType.PasswordReset,
      );
    }

    return { accepted: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user === null) {
      throw this.invalidCredentials();
    }

    await this.consumeVerificationToken(
      VerificationTokenType.PasswordReset,
      dto.token,
      {
        userId: user.id,
      },
    );
    user.passwordHash = await this.hashService.hash(dto.newPassword);
    await this.usersService.markLogin(user);
    await this.logoutAll(user.id);
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw this.invalidCredentials();
    }

    const validPassword = await this.hashService.verify(
      user.passwordHash!,
      dto.currentPassword,
    );
    if (!validPassword) {
      throw this.invalidCredentials();
    }

    user.passwordHash = await this.hashService.hash(dto.newPassword);
    await this.usersService.markLogin(user);
    await this.logoutAll(user.id);
  }

  async validateAccessTokenUser(uuid: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.getByUuid(uuid);

    if (
      user.status === UserStatus.Suspended ||
      user.status === UserStatus.Disabled
    ) {
      throw new AppException(
        ErrorCode.AccountSuspended,
        'This account is not allowed to access the API.',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email ?? '',
      status: user.status,
      userTypes: user.userTypes,
    };
  }

  async pruneExpiredTokens(): Promise<void> {
    await this.refreshTokensRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user);
    const publicUser = await this.usersService.getPublicProfile(user.uuid);

    return {
      ...tokens,
      user: publicUser,
    };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    const refreshTokenId = randomUUID();

    const accessPayload: JwtAccessTokenPayload = {
      sub: user.uuid,
      email: user.email ?? '',
      typ: 'access',
    };
    const refreshPayload: JwtRefreshTokenPayload = {
      sub: user.uuid,
      email: user.email ?? '',
      jti: refreshTokenId,
      typ: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: auth.accessTokenSecret,
        expiresIn: auth.accessTokenTtlSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: auth.refreshTokenSecret,
        expiresIn: auth.refreshTokenTtlSeconds,
      }),
    ]);

    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        tokenId: refreshTokenId,
        userId: user.id,
        tokenHash: await this.hashService.hash(refreshToken),
        expiresAt: new Date(Date.now() + auth.refreshTokenTtlSeconds * 1000),
        revokedAt: null,
        replacedByTokenId: null,
      }),
    );

    return {
      accessToken,
      accessTokenExpiresIn: auth.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresIn: auth.refreshTokenTtlSeconds,
    };
  }

  private async createVerificationToken(
    userId: number,
    type: VerificationTokenType,
    attempts: number = 5,
  ): Promise<string> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    const token = randomBytes(32).toString('base64url');
    const ttl =
      type === VerificationTokenType.PasswordReset
        ? auth.passwordResetTokenTtlSeconds
        : auth.verificationTokenTtlSeconds;

    await this.verificationTokensRepository.save(
      this.verificationTokensRepository.create({
        tokenId: randomUUID(),
        userId,
        type,
        attempts,
        tokenHash: await this.hashService.hash(token),
        expiresAt: new Date(Date.now() + ttl * 1000),
        consumedAt: null,
      }),
    );

    return token;
  }

  private async createPhoneVerificationToken(
    userId: number,
    attempts: number = 5,
  ): Promise<string> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    const token = String(Math.floor(100000 + Math.random() * 900000));

    await this.verificationTokensRepository.save(
      this.verificationTokensRepository.create({
        tokenId: randomUUID(),
        userId,
        type: VerificationTokenType.Phone,
        attempts,
        tokenHash: await this.hashService.hash(token),
        expiresAt: new Date(
          Date.now() + auth.verificationTokenTtlSeconds * 1000,
        ),
        consumedAt: null,
      }),
    );

    return token;
  }

  private async createPhoneVerificationTokenWithPhoneNumber(
    phoneNumber: string,
    maxAttempts = 5,
  ): Promise<string> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    const token = String(Math.floor(100000 + Math.random() * 900000));

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(VerificationToken, { phoneNumber });

      await manager.save(
        VerificationToken,
        manager.create(VerificationToken, {
          tokenId: randomUUID(),
          phoneNumber,
          type: VerificationTokenType.Phone,
          attempts: 0,
          maxAttempts,
          tokenHash: await this.hashService.hash(token),
          expiresAt: new Date(
            Date.now() + auth.verificationTokenTtlSeconds * 1000,
          ),
          consumedAt: null,
        }),
      );

      return token;
    });
  }

  private async createPhoneVerificationTokenWithEmail(
    email: string,
    maxAttempts = 5,
  ): Promise<string> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');
    const token = String(Math.floor(100000 + Math.random() * 900000));

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(VerificationToken, { email });

      await manager.save(
        VerificationToken,
        manager.create(VerificationToken, {
          tokenId: randomUUID(),
          email,
          type: VerificationTokenType.Email,
          attempts: 0,
          maxAttempts,
          tokenHash: await this.hashService.hash(token),
          expiresAt: new Date(
            Date.now() + auth.verificationTokenTtlSeconds * 1000,
          ),
          consumedAt: null,
        }),
      );

      return token;
    });
  }

  private async consumeVerificationToken(
    type: VerificationTokenType,
    tokenValue: string,
    identification: {
      phoneNumber?: string;
      userId?: number;
    },
  ): Promise<void> {
    if (
      identification.phoneNumber === undefined &&
      identification.userId === undefined
    ) {
      throw new BadRequestException('Verification target is required');
    }

    const whereCriteria: FindOptionsWhere<VerificationToken> = {
      type,
    };

    if (identification.phoneNumber !== undefined) {
      whereCriteria.phoneNumber = identification.phoneNumber;
    }

    if (identification.userId !== undefined) {
      whereCriteria.userId = identification.userId;
    }

    const token = await this.verificationTokensRepository.findOne({
      where: whereCriteria,
    });

    if (token === null) {
      throw new BadRequestException('Invalid OTP');
    }

    const now = new Date();

    if (token.expiresAt < now) {
      throw new BadRequestException('OTP has expired');
    }

    if (token.attempts >= token.maxAttempts) {
      throw new BadRequestException('OTP attempts exceeded');
    }

    const tokenMatches = await this.hashService.verify(
      token.tokenHash,
      tokenValue,
    );

    if (!tokenMatches) {
      token.attempts += 1;
      await this.verificationTokensRepository.save(token);
      throw new BadRequestException('Invalid OTP');
    }

    token.consumedAt = now;
    await this.verificationTokensRepository.save(token);
  }

  private async getRefreshTokenId(refreshToken: string): Promise<string> {
    const tokenId = await this.tryGetRefreshTokenId(refreshToken);
    if (tokenId === null) {
      throw this.invalidCredentials();
    }

    return tokenId;
  }

  private async tryGetRefreshTokenId(
    refreshToken: string,
  ): Promise<string | null> {
    const auth = this.configService.getOrThrow<AuthConfiguration>('auth');

    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshTokenPayload>(
        refreshToken,
        { secret: auth.refreshTokenSecret },
      );
      return payload.jti;
    } catch {
      return null;
    }
  }

  private invalidCredentials(): AppException {
    return new AppException(
      ErrorCode.InvalidCredentials,
      'The supplied credentials are invalid.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
