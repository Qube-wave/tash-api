jest.mock(
  'src/notifications/notifications.service',
  () => ({
    NotificationsService: class NotificationsService {},
  }),
  { virtual: true },
);

import { BadRequestException } from '@nestjs/common';
import { AuthService, OnboardingStepResponse } from './auth.service';
import { RegistrationStep } from './entities/registration-session.entity';
import { User, UserStatus, UserType } from '../users/entities/user.entity';
import { PublicUserProfile } from '../users/users.service';

const authConfig = {
  accessTokenSecret: 'access-secret',
  refreshTokenSecret: 'refresh-secret',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 3600,
  verificationTokenTtlSeconds: 86400,
  passwordResetTokenTtlSeconds: 1800,
};

const publicProfile: PublicUserProfile = {
  uuid: 'user-uuid',
  email: 'ada@example.com',
  phoneNumber: '',
  paymentTag: 'ada',
  status: UserStatus.PendingRegistration,
  userTypes: [UserType.Consumer],
  profile: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    dateOfBirth: '1990-01-01',
    country: 'NG',
    defaultCurrency: 'NGN',
  },
};

function createSession(step: RegistrationStep, overrides = {}) {
  return {
    id: 1,
    tokenId: 'session-id',
    tokenHash: 'hashed-secret',
    userId: 42,
    currentStep: step,
    completedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.PendingRegistration,
      userTypes: [UserType.Consumer],
    },
    ...overrides,
  };
}

function createService() {
  const refreshTokensRepository = {
    create: jest.fn().mockImplementation((value) => value),
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (value) => value),
  };
  const verificationTokensRepository = {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (value) => value),
  };
  const registrationSessionsRepository = {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (value) => value),
    update: jest.fn(),
    create: jest.fn().mockImplementation((value) => value),
  };
  const usersService = {
    completeRegistrationProfile: jest.fn(),
    completeRegistrationPaymentTag: jest.fn(),
    completeRegistration: jest.fn(),
    createUserWithEmail: jest.fn(),
    createUserWithPhoneNumber: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    getRegistrationProgress: jest.fn(),
    getPublicProfile: jest.fn(),
    getByUuid: jest.fn(),
    markLogin: jest.fn(),
    markRegistrationEmailVerified: jest.fn(),
    markRegistrationPhoneVerified: jest.fn(),
  };
  const settingsService = {
    createDefaults: jest.fn(),
    createTransactionPin: jest.fn(),
    hasTransactionPin: jest.fn().mockResolvedValue(false),
    validateTransactionPin: jest.fn(),
  };
  const walletsService = {
    createDefaultWallet: jest.fn(),
  };
  const hashService = {
    hash: jest
      .fn()
      .mockImplementation(async (value: string) => `hashed:${value}`),
    verify: jest.fn().mockResolvedValue(true),
  };
  const jwtService = {
    signAsync: jest
      .fn()
      .mockImplementation(async (payload: { typ: string }) =>
        payload.typ === 'access' ? 'access-token' : 'refresh-token',
      ),
    verifyAsync: jest.fn().mockResolvedValue({
      sub: 'user-uuid',
      email: 'ada@example.com',
      jti: 'refresh-token-id',
      typ: 'refresh',
    }),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(authConfig),
  };
  const notificationService = {
    enqueueOtpEmailNotification: jest.fn(),
    enqueuOtpSmsNotification: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        delete: jest.fn(),
        create: jest.fn((_entity, value) => value),
        save: jest.fn(async (_entity, value) => value),
      }),
    ),
  };

  const service = new AuthService(
    refreshTokensRepository as never,
    verificationTokensRepository as never,
    registrationSessionsRepository as never,
    usersService as never,
    settingsService as never,
    walletsService as never,
    hashService as never,
    jwtService as never,
    configService as never,
    notificationService as never,
    dataSource as never,
  );

  return {
    service,
    refreshTokensRepository,
    registrationSessionsRepository,
    verificationTokensRepository,
    usersService,
    settingsService,
    walletsService,
    hashService,
    jwtService,
    notificationService,
    dataSource,
  };
}

describe('AuthService onboarding', () => {
  it('completes the profile step and advances to claim tag', async () => {
    const { service, registrationSessionsRepository, usersService } =
      createService();
    const session = createSession(RegistrationStep.Profile);
    registrationSessionsRepository.findOne.mockResolvedValue(session);
    usersService.completeRegistrationProfile.mockResolvedValue(publicProfile);

    const response: OnboardingStepResponse =
      await service.completeOnboardingProfile({
        onboardingSessionToken: 'session-id.secret',
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1990-01-01',
      });

    expect(usersService.completeRegistrationProfile).toHaveBeenCalledWith(42, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1990-01-01',
    });
    expect(session.currentStep).toBe(RegistrationStep.ClaimTag);
    expect(registrationSessionsRepository.save).toHaveBeenCalledWith(session);
    expect(response).toEqual({
      currentStep: RegistrationStep.ClaimTag,
      user: publicProfile,
    });
  });

  it('claims a payment tag and advances to pin', async () => {
    const { service, registrationSessionsRepository, usersService } =
      createService();
    const session = createSession(RegistrationStep.ClaimTag);
    registrationSessionsRepository.findOne.mockResolvedValue(session);
    usersService.completeRegistrationPaymentTag.mockResolvedValue(
      publicProfile,
    );

    const response = await service.completeOnboardingTag({
      onboardingSessionToken: 'session-id.secret',
      paymentTag: 'ada',
    });

    expect(usersService.completeRegistrationPaymentTag).toHaveBeenCalledWith(
      42,
      'ada',
    );
    expect(session.currentStep).toBe(RegistrationStep.Pin);
    expect(response.currentStep).toBe(RegistrationStep.Pin);
  });

  it('creates a pin, activates the user, completes the session, and returns auth tokens', async () => {
    const {
      service,
      registrationSessionsRepository,
      usersService,
      settingsService,
      walletsService,
      refreshTokensRepository,
    } = createService();
    const session = createSession(RegistrationStep.Pin);
    const activeUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.Active,
      userTypes: [UserType.Consumer],
    } as User;
    const activeProfile = { ...publicProfile, status: UserStatus.Active };

    registrationSessionsRepository.findOne.mockResolvedValue(session);
    usersService.completeRegistration.mockResolvedValue(activeUser);
    usersService.getPublicProfile.mockResolvedValue(activeProfile);

    const response = await service.completeOnboardingPin({
      onboardingSessionToken: 'session-id.secret',
      pin: '1234',
    });

    expect(settingsService.createDefaults).toHaveBeenCalledWith(42);
    expect(settingsService.createTransactionPin).toHaveBeenCalledWith(
      42,
      '1234',
    );
    expect(usersService.completeRegistration).toHaveBeenCalledWith(42);
    expect(walletsService.createDefaultWallet).toHaveBeenCalledWith(42);
    expect(session.currentStep).toBe(RegistrationStep.Complete);
    expect(session.completedAt).toBeInstanceOf(Date);
    expect(refreshTokensRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        tokenHash: 'hashed:refresh-token',
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: activeProfile,
      }),
    );
  });

  it('resumes a pending email registration at the next incomplete step', async () => {
    const {
      service,
      registrationSessionsRepository,
      verificationTokensRepository,
      usersService,
      settingsService,
    } = createService();
    const existingUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.PendingRegistration,
      userTypes: [UserType.Consumer],
    } as User;

    verificationTokensRepository.findOne.mockResolvedValue({
      tokenHash: 'hashed-otp',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    usersService.findByEmail.mockResolvedValue(existingUser);
    usersService.markRegistrationEmailVerified.mockResolvedValue(existingUser);
    usersService.getRegistrationProgress.mockResolvedValue({
      user: existingUser,
      hasProfile: true,
      hasPaymentTag: false,
    });
    settingsService.hasTransactionPin.mockResolvedValue(false);
    registrationSessionsRepository.save.mockImplementation(async (value) => ({
      ...value,
      currentStep: value.currentStep,
    }));

    const response = await service.completeEmailVerification({
      email: 'ada@example.com',
      token: '123456',
    });

    expect(usersService.createUserWithEmail).not.toHaveBeenCalled();
    expect(usersService.markRegistrationEmailVerified).toHaveBeenCalledWith(
      existingUser,
    );
    expect(registrationSessionsRepository.update).toHaveBeenCalledWith(
      { userId: 42, completedAt: expect.anything() },
      { completedAt: expect.any(Date) },
    );
    expect(registrationSessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        currentStep: RegistrationStep.ClaimTag,
        completedAt: null,
      }),
    );
    expect(response.currentStep).toBe(RegistrationStep.ClaimTag);
    expect(response.onboardingSessionToken).toMatch(/^.+\..+$/);
  });

  it('sends a login OTP only for active email users', async () => {
    const { service, usersService, notificationService, dataSource } =
      createService();
    const activeUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.Active,
      userTypes: [UserType.Consumer],
    } as User;
    usersService.findByEmail.mockResolvedValue(activeUser);

    const response = await service.sendLoginEmailVerification({
      email: 'ada@example.com',
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(
      notificationService.enqueueOtpEmailNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        length: 6,
        attempts: 5,
      }),
    );
    expect(response).toEqual({
      message: 'A login code has been sent to your email',
    });
  });

  it('completes email OTP login and returns auth tokens', async () => {
    const {
      service,
      verificationTokensRepository,
      usersService,
      refreshTokensRepository,
    } = createService();
    const activeUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.Active,
      userTypes: [UserType.Consumer],
    } as User;
    const activeProfile = { ...publicProfile, status: UserStatus.Active };

    verificationTokensRepository.findOne.mockResolvedValue({
      tokenHash: 'hashed-otp',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    usersService.findByEmail.mockResolvedValue(activeUser);
    usersService.getPublicProfile.mockResolvedValue(activeProfile);

    const response = await service.completeLoginEmailVerification({
      email: 'ada@example.com',
      token: '123456',
    });

    expect(usersService.markLogin).toHaveBeenCalledWith(activeUser);
    expect(refreshTokensRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42 }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: activeProfile,
      }),
    );
  });

  it('rejects OTP login for pending registrations', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue({
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.PendingRegistration,
      userTypes: [UserType.Consumer],
    } as User);

    await expect(
      service.sendLoginEmailVerification({ email: 'ada@example.com' }),
    ).rejects.toThrow('Complete registration before signing in.');
  });

  it('unlocks with refresh token and pin, then rotates refresh tokens', async () => {
    const { service, refreshTokensRepository, usersService, settingsService } =
      createService();
    const storedRefreshToken = {
      tokenId: 'refresh-token-id',
      userId: 42,
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByTokenId: null,
    };
    const activeUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.Active,
      userTypes: [UserType.Consumer],
    } as User;
    const activeProfile = { ...publicProfile, status: UserStatus.Active };

    refreshTokensRepository.findOne.mockResolvedValue(storedRefreshToken);
    usersService.getByUuid.mockResolvedValue(activeUser);
    usersService.getPublicProfile.mockResolvedValue(activeProfile);

    const response = await service.unlock({
      refreshToken: 'refresh-token',
      pin: '1234',
    });

    expect(settingsService.validateTransactionPin).toHaveBeenCalledWith(
      42,
      '1234',
    );
    expect(storedRefreshToken.revokedAt).toBeInstanceOf(Date);
    expect(storedRefreshToken.replacedByTokenId).toBe('refresh-token-id');
    expect(refreshTokensRepository.save).toHaveBeenCalledWith(
      storedRefreshToken,
    );
    expect(response).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: activeProfile,
      }),
    );
  });

  it('does not rotate refresh tokens when unlock pin validation fails', async () => {
    const { service, refreshTokensRepository, usersService, settingsService } =
      createService();
    const storedRefreshToken = {
      tokenId: 'refresh-token-id',
      userId: 42,
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByTokenId: null,
    };
    const activeUser = {
      id: 42,
      uuid: 'user-uuid',
      email: 'ada@example.com',
      status: UserStatus.Active,
      userTypes: [UserType.Consumer],
    } as User;

    refreshTokensRepository.findOne.mockResolvedValue(storedRefreshToken);
    usersService.getByUuid.mockResolvedValue(activeUser);
    settingsService.validateTransactionPin.mockRejectedValue(
      new Error('Invalid PIN'),
    );

    await expect(
      service.unlock({ refreshToken: 'refresh-token', pin: '0000' }),
    ).rejects.toThrow('Invalid PIN');
    expect(storedRefreshToken.revokedAt).toBeNull();
    expect(refreshTokensRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an onboarding session used at the wrong step', async () => {
    const { service, registrationSessionsRepository, usersService } =
      createService();
    registrationSessionsRepository.findOne.mockResolvedValue(
      createSession(RegistrationStep.Profile),
    );

    await expect(
      service.completeOnboardingTag({
        onboardingSessionToken: 'session-id.secret',
        paymentTag: 'ada',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.completeRegistrationPaymentTag).not.toHaveBeenCalled();
  });

  it('rejects a malformed onboarding session token', async () => {
    const { service, registrationSessionsRepository } = createService();

    await expect(
      service.completeOnboardingProfile({
        onboardingSessionToken: 'invalid-token',
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1990-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registrationSessionsRepository.findOne).not.toHaveBeenCalled();
  });
});
