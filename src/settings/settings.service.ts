import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorCode } from '../common/errors/error-code';
import { AppException } from '../common/errors/app.exception';
import { HashService } from '../common/crypto/hash.service';
import { SecurityConfiguration } from '../config/security.config';
import { UsersService } from '../users/users.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { TransactionPin } from './entities/transaction-pin.entity';
import { UserPaymentSettings } from './entities/user-payment-settings.entity';
import { calculateFailedPinState } from './transaction-pin-policy';

export interface PaymentSettingsResponse {
  requireTransactionPin: boolean;
  allowCardPayments: boolean;
  allowDirectDebitPayments: boolean;
  allowWalletPayments: boolean;
  allowMerchantPayments: boolean;
  dailyTransferLimit: number;
  dailyPaymentLimit: number;
  singleTransactionLimit: number;
  notificationPreferences: Record<string, unknown>;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserPaymentSettings)
    private readonly settingsRepository: Repository<UserPaymentSettings>,
    @InjectRepository(TransactionPin)
    private readonly pinRepository: Repository<TransactionPin>,
    private readonly hashService: HashService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async createDefaults(userId: number): Promise<UserPaymentSettings> {
    const existing = await this.settingsRepository.findOne({
      where: { userId },
    });
    if (existing !== null) {
      return existing;
    }

    return this.settingsRepository.save(
      this.settingsRepository.create({ userId }),
    );
  }

  async getPaymentSettings(userId: number): Promise<PaymentSettingsResponse> {
    const settings = await this.getOrCreateSettings(userId);
    return this.toResponse(settings);
  }

  async updatePaymentSettings(
    userId: number,
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponse> {
    const settings = await this.getOrCreateSettings(userId);

    if (dto.defaultCardId !== undefined)
      settings.defaultCardId = dto.defaultCardId;
    if (dto.defaultDirectDebitMandateId !== undefined) {
      settings.defaultDirectDebitMandateId = dto.defaultDirectDebitMandateId;
    }
    if (dto.defaultWalletId !== undefined)
      settings.defaultWalletId = dto.defaultWalletId;
    if (dto.requireTransactionPin !== undefined) {
      settings.requireTransactionPin = dto.requireTransactionPin;
    }
    if (dto.allowCardPayments !== undefined) {
      settings.allowCardPayments = dto.allowCardPayments;
    }
    if (dto.allowDirectDebitPayments !== undefined) {
      settings.allowDirectDebitPayments = dto.allowDirectDebitPayments;
    }
    if (dto.allowWalletPayments !== undefined) {
      settings.allowWalletPayments = dto.allowWalletPayments;
    }
    if (dto.allowMerchantPayments !== undefined) {
      settings.allowMerchantPayments = dto.allowMerchantPayments;
    }
    if (dto.dailyTransferLimit !== undefined) {
      settings.dailyTransferLimit = String(dto.dailyTransferLimit);
    }
    if (dto.dailyPaymentLimit !== undefined) {
      settings.dailyPaymentLimit = String(dto.dailyPaymentLimit);
    }
    if (dto.singleTransactionLimit !== undefined) {
      settings.singleTransactionLimit = String(dto.singleTransactionLimit);
    }
    if (dto.notificationPreferences !== undefined) {
      settings.notificationPreferences = dto.notificationPreferences;
    }

    return this.toResponse(await this.settingsRepository.save(settings));
  }

  async createTransactionPin(userId: number, pin: string): Promise<void> {
    const existing = await this.pinRepository.findOne({ where: { userId } });
    if (existing !== null) {
      throw new ConflictException('Transaction PIN already exists.');
    }

    await this.pinRepository.save(
      this.pinRepository.create({
        userId,
        pinHash: await this.hashService.hash(pin),
        failedAttempts: 0,
        lockedUntil: null,
        lastChangedAt: new Date(),
      }),
    );
  }

  async updateTransactionPin(
    userId: number,
    currentPin: string,
    newPin: string,
  ): Promise<void> {
    await this.validateTransactionPin(userId, currentPin);
    const pin = await this.getPin(userId);
    pin.pinHash = await this.hashService.hash(newPin);
    pin.failedAttempts = 0;
    pin.lockedUntil = null;
    pin.lastChangedAt = new Date();
    await this.pinRepository.save(pin);
  }

  async resetTransactionPin(
    userId: number,
    currentPassword: string,
    newPin: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    const validPassword = await this.hashService.verify(
      user.passwordHash,
      currentPassword,
    );
    if (!validPassword) {
      throw new AppException(
        ErrorCode.InvalidCredentials,
        'Current password is incorrect.',
        401,
      );
    }

    const existing = await this.pinRepository.findOne({ where: { userId } });
    const pin = existing ?? this.pinRepository.create({ userId });
    pin.pinHash = await this.hashService.hash(newPin);
    pin.failedAttempts = 0;
    pin.lockedUntil = null;
    pin.lastChangedAt = new Date();
    await this.pinRepository.save(pin);
  }

  async validateTransactionPin(
    userId: number,
    pinValue: string,
  ): Promise<void> {
    const pin = await this.getPin(userId);
    const now = new Date();

    if (pin.lockedUntil !== null && pin.lockedUntil > now) {
      throw new AppException(
        ErrorCode.TransactionPinLocked,
        'Transaction PIN is temporarily locked.',
        423,
      );
    }

    const valid = await this.hashService.verify(pin.pinHash, pinValue);
    if (valid) {
      pin.failedAttempts = 0;
      pin.lockedUntil = null;
      await this.pinRepository.save(pin);
      return;
    }

    const security =
      this.configService.getOrThrow<SecurityConfiguration>('security');
    const failedState = calculateFailedPinState(
      pin.failedAttempts,
      {
        maxAttempts: security.transactionPinMaxAttempts,
        lockMinutes: security.transactionPinLockMinutes,
      },
      now,
    );
    pin.failedAttempts = failedState.failedAttempts;
    pin.lockedUntil = failedState.lockedUntil;

    await this.pinRepository.save(pin);

    throw new AppException(
      ErrorCode.InvalidTransactionPin,
      'Transaction PIN is incorrect.',
      401,
    );
  }

  private async getOrCreateSettings(
    userId: number,
  ): Promise<UserPaymentSettings> {
    return (
      (await this.settingsRepository.findOne({ where: { userId } })) ??
      this.createDefaults(userId)
    );
  }

  private async getPin(userId: number): Promise<TransactionPin> {
    const pin = await this.pinRepository.findOne({ where: { userId } });
    if (pin === null) {
      throw new AppException(
        ErrorCode.TransactionPinRequired,
        'Transaction PIN has not been created.',
        400,
      );
    }

    return pin;
  }

  private toResponse(settings: UserPaymentSettings): PaymentSettingsResponse {
    return {
      requireTransactionPin: settings.requireTransactionPin,
      allowCardPayments: settings.allowCardPayments,
      allowDirectDebitPayments: settings.allowDirectDebitPayments,
      allowWalletPayments: settings.allowWalletPayments,
      allowMerchantPayments: settings.allowMerchantPayments,
      dailyTransferLimit: Number(settings.dailyTransferLimit),
      dailyPaymentLimit: Number(settings.dailyPaymentLimit),
      singleTransactionLimit: Number(settings.singleTransactionLimit),
      notificationPreferences: settings.notificationPreferences,
    };
  }
}
