import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from '../common/crypto/encryption.service';
import { HashService } from '../common/crypto/hash.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import {
  CreateMerchantApiKeyDto,
  CreateMerchantDto,
  UpdateMerchantDto,
  UpdateMerchantSettingsDto,
} from './dto/merchant.dto';
import {
  MerchantApiKey,
  MerchantApiKeyStatus,
} from './entities/merchant-api-key.entity';
import { MerchantSettings } from './entities/merchant-settings.entity';
import {
  MerchantCustomer,
  MerchantCustomerStatus,
} from './entities/merchant-customer.entity';
import {
  Merchant,
  MerchantStatus,
  MerchantVerificationStatus,
} from './entities/merchant.entity';
import { AuthenticatedMerchant } from './merchant-authenticated';
import {
  createMerchantApiKey,
  parseMerchantApiKey,
} from './merchant-api-key.util';

export interface MerchantResponse {
  uuid: string;
  businessName: string;
  displayName: string;
  merchantCode: string;
  email: string;
  phoneNumber: string;
  businessType: string;
  registrationNumber: string | null;
  country: string;
  defaultCurrency: string;
  verificationStatus: MerchantVerificationStatus;
  status: MerchantStatus;
  createdAt: Date;
}

export interface MerchantSettingsResponse {
  webhookUrl: string | null;
  callbackUrl: string | null;
  allowedRedirectUrls: string[];
  allowCardPayments: boolean;
  allowDirectDebitPayments: boolean;
  allowWalletPayments: boolean;
  checkoutName: string | null;
  checkoutDescription: string | null;
  checkoutLogoUrl: string | null;
}

export interface MerchantApiKeyResponse {
  uuid: string;
  name: string;
  keyPrefix: string;
  environment: string;
  status: MerchantApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreatedMerchantApiKeyResponse extends MerchantApiKeyResponse {
  apiKey: string;
}

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantsRepository: Repository<Merchant>,
    @InjectRepository(MerchantSettings)
    private readonly settingsRepository: Repository<MerchantSettings>,
    @InjectRepository(MerchantApiKey)
    private readonly apiKeysRepository: Repository<MerchantApiKey>,
    @InjectRepository(MerchantCustomer)
    private readonly merchantCustomersRepository: Repository<MerchantCustomer>,
    private readonly encryptionService: EncryptionService,
    private readonly hashService: HashService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    ownerId: number,
    dto: CreateMerchantDto,
  ): Promise<MerchantResponse> {
    const merchant = await this.merchantsRepository.save(
      this.merchantsRepository.create({
        ownerId,
        businessName: dto.businessName.trim(),
        displayName: dto.displayName.trim(),
        merchantCode: this.generateMerchantCode(dto.displayName),
        email: dto.email.trim().toLowerCase(),
        phoneNumber: dto.phoneNumber.trim(),
        businessType: dto.businessType.trim(),
        registrationNumber: dto.registrationNumber?.trim() ?? null,
        country: dto.country.toUpperCase(),
        defaultCurrency: dto.defaultCurrency.toUpperCase(),
        verificationStatus: MerchantVerificationStatus.Unverified,
        status: MerchantStatus.Active,
      }),
    );

    await this.settingsRepository.save(
      this.settingsRepository.create({
        merchantId: merchant.id,
        webhookUrl: null,
        webhookSecretHash: null,
        webhookSecretCiphertext: null,
        callbackUrl: null,
        allowedRedirectUrls: [],
        allowCardPayments: true,
        allowDirectDebitPayments: true,
        allowWalletPayments: true,
        checkoutName: merchant.displayName,
        checkoutDescription: null,
        checkoutLogoUrl: null,
      }),
    );

    return this.toResponse(merchant);
  }

  async getMine(ownerId: number): Promise<MerchantResponse> {
    return this.toResponse(await this.getMerchantByOwner(ownerId));
  }

  async updateMine(
    ownerId: number,
    dto: UpdateMerchantDto,
  ): Promise<MerchantResponse> {
    const merchant = await this.getMerchantByOwner(ownerId);
    if (dto.businessName !== undefined)
      merchant.businessName = dto.businessName.trim();
    if (dto.displayName !== undefined)
      merchant.displayName = dto.displayName.trim();
    if (dto.email !== undefined)
      merchant.email = dto.email.trim().toLowerCase();
    if (dto.phoneNumber !== undefined)
      merchant.phoneNumber = dto.phoneNumber.trim();
    return this.toResponse(await this.merchantsRepository.save(merchant));
  }

  async getPublicByCode(merchantCode: string): Promise<MerchantResponse> {
    const merchant = await this.merchantsRepository.findOne({
      where: { merchantCode },
    });
    if (merchant === null) {
      throw new AppException(
        ErrorCode.MerchantNotFound,
        'Merchant was not found.',
        404,
      );
    }
    return this.toResponse(merchant);
  }

  async getMerchantByOwner(ownerId: number): Promise<Merchant> {
    const merchant = await this.merchantsRepository.findOne({
      where: { ownerId },
    });
    if (merchant === null) {
      throw new AppException(
        ErrorCode.MerchantNotFound,
        'Merchant was not found.',
        404,
      );
    }
    return merchant;
  }

  async getMerchantById(id: number): Promise<Merchant> {
    const merchant = await this.merchantsRepository.findOne({ where: { id } });
    if (merchant === null) {
      throw new AppException(
        ErrorCode.MerchantNotFound,
        'Merchant was not found.',
        404,
      );
    }
    return merchant;
  }

  async getSettings(merchantId: number): Promise<MerchantSettings> {
    const settings = await this.settingsRepository.findOne({
      where: { merchantId },
    });
    if (settings === null) {
      throw new AppException(
        ErrorCode.MerchantNotFound,
        'Merchant settings were not found.',
        404,
      );
    }
    return settings;
  }

  async getSettingsResponse(
    ownerId: number,
  ): Promise<MerchantSettingsResponse> {
    const merchant = await this.getMerchantByOwner(ownerId);
    return this.toSettingsResponse(await this.getSettings(merchant.id));
  }

  async updateSettings(
    ownerId: number,
    dto: UpdateMerchantSettingsDto,
  ): Promise<MerchantSettingsResponse> {
    const merchant = await this.getMerchantByOwner(ownerId);
    const settings = await this.getSettings(merchant.id);
    if (dto.webhookUrl !== undefined) settings.webhookUrl = dto.webhookUrl;
    if (dto.callbackUrl !== undefined) settings.callbackUrl = dto.callbackUrl;
    if (dto.allowedRedirectUrls !== undefined)
      settings.allowedRedirectUrls = dto.allowedRedirectUrls;
    if (dto.allowCardPayments !== undefined)
      settings.allowCardPayments = dto.allowCardPayments;
    if (dto.allowDirectDebitPayments !== undefined)
      settings.allowDirectDebitPayments = dto.allowDirectDebitPayments;
    if (dto.allowWalletPayments !== undefined)
      settings.allowWalletPayments = dto.allowWalletPayments;
    if (dto.checkoutName !== undefined)
      settings.checkoutName = dto.checkoutName;
    if (dto.checkoutDescription !== undefined)
      settings.checkoutDescription = dto.checkoutDescription;
    if (dto.checkoutLogoUrl !== undefined)
      settings.checkoutLogoUrl = dto.checkoutLogoUrl;
    return this.toSettingsResponse(
      await this.settingsRepository.save(settings),
    );
  }

  async rotateWebhookSecret(
    ownerId: number,
  ): Promise<{ webhookSecret: string }> {
    const merchant = await this.getMerchantByOwner(ownerId);
    const settings = await this.getSettings(merchant.id);
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    settings.webhookSecretHash = await this.hashService.hash(secret);
    settings.webhookSecretCiphertext = this.encryptionService.encrypt(secret);
    await this.settingsRepository.save(settings);
    await this.auditLogsService.record({
      userId: ownerId,
      merchantId: merchant.id,
      action: 'merchant.webhook_secret.rotate',
      resourceType: 'merchant',
      resourceId: merchant.uuid,
    });
    return { webhookSecret: secret };
  }

  async createApiKey(
    ownerId: number,
    dto: CreateMerchantApiKeyDto,
  ): Promise<CreatedMerchantApiKeyResponse> {
    const merchant = await this.getMerchantByOwner(ownerId);
    const generated = createMerchantApiKey(dto.environment);
    const entity = await this.apiKeysRepository.save(
      this.apiKeysRepository.create({
        merchantId: merchant.id,
        name: dto.name.trim(),
        keyPrefix: generated.keyPrefix,
        secretHash: await this.hashService.hash(generated.secret),
        environment: dto.environment,
        status: MerchantApiKeyStatus.Active,
        lastUsedAt: null,
        expiresAt: null,
      }),
    );
    await this.auditLogsService.record({
      userId: ownerId,
      merchantId: merchant.id,
      action: 'merchant.api_key.create',
      resourceType: 'merchant_api_key',
      resourceId: entity.uuid,
      metadata: {
        environment: entity.environment,
        keyPrefix: entity.keyPrefix,
      },
    });
    return { ...this.toApiKeyResponse(entity), apiKey: generated.fullKey };
  }

  async listApiKeys(ownerId: number): Promise<MerchantApiKeyResponse[]> {
    const merchant = await this.getMerchantByOwner(ownerId);
    const keys = await this.apiKeysRepository.find({
      where: { merchantId: merchant.id },
      order: { createdAt: 'DESC' },
    });
    return keys.map((key) => this.toApiKeyResponse(key));
  }

  async revokeApiKey(ownerId: number, uuid: string): Promise<void> {
    const merchant = await this.getMerchantByOwner(ownerId);
    const key = await this.apiKeysRepository.findOne({
      where: { merchantId: merchant.id, uuid },
    });
    if (key === null) {
      throw new AppException(
        ErrorCode.InvalidCredentials,
        'Merchant API key was not found.',
        404,
      );
    }
    key.status = MerchantApiKeyStatus.Revoked;
    await this.apiKeysRepository.save(key);
    await this.auditLogsService.record({
      userId: ownerId,
      merchantId: merchant.id,
      action: 'merchant.api_key.revoke',
      resourceType: 'merchant_api_key',
      resourceId: key.uuid,
      metadata: { keyPrefix: key.keyPrefix },
    });
  }

  async authenticateApiKey(apiKey: string): Promise<AuthenticatedMerchant> {
    const parsed = parseMerchantApiKey(apiKey);
    if (parsed === null) {
      throw new AppException(
        ErrorCode.InvalidCredentials,
        'Merchant API key is invalid.',
        401,
      );
    }

    const candidates = await this.apiKeysRepository.find({
      where: {
        keyPrefix: parsed.keyPrefix,
        environment: parsed.environment,
        status: MerchantApiKeyStatus.Active,
      },
    });

    for (const candidate of candidates) {
      if (candidate.expiresAt !== null && candidate.expiresAt <= new Date()) {
        candidate.status = MerchantApiKeyStatus.Expired;
        await this.apiKeysRepository.save(candidate);
        continue;
      }

      if (await this.hashService.verify(candidate.secretHash, parsed.secret)) {
        const merchant = await this.getMerchantById(candidate.merchantId);
        if (merchant.status !== MerchantStatus.Active) {
          throw new AppException(
            ErrorCode.MerchantNotActive,
            'Merchant is not active.',
            403,
          );
        }
        candidate.lastUsedAt = new Date();
        await this.apiKeysRepository.save(candidate);
        return {
          merchant,
          apiKeyId: candidate.id,
          environment: candidate.environment,
        };
      }
    }

    throw new AppException(
      ErrorCode.InvalidCredentials,
      'Merchant API key is invalid.',
      401,
    );
  }

  async recordCustomerRelationship(
    merchantId: number,
    userId: number,
  ): Promise<void> {
    const existing = await this.merchantCustomersRepository.findOne({
      where: { merchantId, userId },
    });

    if (existing !== null) {
      if (existing.status !== MerchantCustomerStatus.Active) {
        existing.status = MerchantCustomerStatus.Active;
        await this.merchantCustomersRepository.save(existing);
      }
      return;
    }

    await this.merchantCustomersRepository.save(
      this.merchantCustomersRepository.create({
        merchantId,
        userId,
        merchantCustomerReference: null,
        status: MerchantCustomerStatus.Active,
        metadata: {},
      }),
    );
  }

  toResponse(merchant: Merchant): MerchantResponse {
    return {
      uuid: merchant.uuid,
      businessName: merchant.businessName,
      displayName: merchant.displayName,
      merchantCode: merchant.merchantCode,
      email: merchant.email,
      phoneNumber: merchant.phoneNumber,
      businessType: merchant.businessType,
      registrationNumber: merchant.registrationNumber,
      country: merchant.country,
      defaultCurrency: merchant.defaultCurrency,
      verificationStatus: merchant.verificationStatus,
      status: merchant.status,
      createdAt: merchant.createdAt,
    };
  }

  toSettingsResponse(settings: MerchantSettings): MerchantSettingsResponse {
    return {
      webhookUrl: settings.webhookUrl,
      callbackUrl: settings.callbackUrl,
      allowedRedirectUrls: settings.allowedRedirectUrls,
      allowCardPayments: settings.allowCardPayments,
      allowDirectDebitPayments: settings.allowDirectDebitPayments,
      allowWalletPayments: settings.allowWalletPayments,
      checkoutName: settings.checkoutName,
      checkoutDescription: settings.checkoutDescription,
      checkoutLogoUrl: settings.checkoutLogoUrl,
    };
  }

  private toApiKeyResponse(key: MerchantApiKey): MerchantApiKeyResponse {
    return {
      uuid: key.uuid,
      name: key.name,
      keyPrefix: key.keyPrefix,
      environment: key.environment,
      status: key.status,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    };
  }

  private generateMerchantCode(displayName: string): string {
    const slug =
      displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 18) || 'merchant';
    return `mch_${slug}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  }
}
