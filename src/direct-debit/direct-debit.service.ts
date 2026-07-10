import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import {
  assertMandateAmountAllowed,
  assertMandateChargeable,
  normalizeAccountNumberLastFour,
} from './direct-debit-policy';
import {
  AuthorizeDirectDebitMandateDto,
  CreateDirectDebitMandateDto,
} from './dto/direct-debit.dto';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from './entities/direct-debit-mandate.entity';
import type { ProviderDirectDebitMandate } from '../payment-providers/interfaces/payment-provider.interface';

export interface DirectDebitMandateResponse {
  uuid: string;
  provider: string;
  bankName: string | null;
  accountName: string | null;
  accountNumberLastFour: string | null;
  bankCode: string;
  currency: string;
  maximumAmount: number;
  status: DirectDebitMandateStatus;
  authorizedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class DirectDebitService {
  constructor(
    @InjectRepository(DirectDebitMandate)
    private readonly mandatesRepository: Repository<DirectDebitMandate>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}

  async createMandate(
    userUuid: string,
    dto: CreateDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    const user = await this.usersService.getByUuid(userUuid);
    const publicProfile = await this.usersService.getPublicProfile(userUuid);

    if (user.phoneNumber === null) {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        'A phone number is required to create a direct-debit mandate.',
        400,
      );
    }

    if (user.email === null) {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        'An email address is required to create a direct-debit mandate.',
        400,
      );
    }

    const customerName = publicProfile.profile
      ? `${publicProfile.profile.firstName} ${publicProfile.profile.lastName}`
      : dto.accountName;
    const provider = this.providerFactory.getProvider();
    const providerMandate = await provider.createDirectDebitMandate({
      userUuid,
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName,
      customerName,
      customerEmail: user.email,
      customerPhoneNumber: user.phoneNumber,
      customerAddress: publicProfile.profile?.country ?? 'Nigeria',
      maximumAmount: dto.maximumAmount,
      currency: dto.currency.toUpperCase(),
    });

    const mandate = await this.mandatesRepository.save(
      this.mandatesRepository.create({
        userId: user.id,
        provider: providerMandate.provider,
        providerCustomerId: providerMandate.providerCustomerId ?? null,
        providerMandateId: providerMandate.providerMandateId,
        authorizationReference: providerMandate.authorizationReference ?? null,
        bankName: providerMandate.bankName ?? null,
        accountName: providerMandate.accountName ?? dto.accountName,
        accountNumberLastFour:
          providerMandate.accountNumberLastFour ??
          normalizeAccountNumberLastFour(dto.accountNumber),
        bankCode: providerMandate.bankCode ?? dto.bankCode,
        currency: dto.currency.toUpperCase(),
        maximumAmount: String(dto.maximumAmount),
        status: this.mapProviderStatus(providerMandate.status),
        authorizedAt:
          this.mapProviderStatus(providerMandate.status) ===
          DirectDebitMandateStatus.Active
            ? new Date()
            : null,
        expiresAt: null,
        revokedAt: null,
        failureReason: providerMandate.failureReason ?? null,
        metadata: providerMandate.metadata,
      }),
    );

    console.log(mandate)

    return this.toResponse(mandate);
  }

  async listForUser(userId: number): Promise<DirectDebitMandateResponse[]> {
    const mandates = await this.mandatesRepository.find({
      where: { userId, status: Not(DirectDebitMandateStatus.Revoked) },
      order: { createdAt: 'DESC' },
    });
    return mandates.map((mandate) => this.toResponse(mandate));
  }

  async getForUser(userId: number, uuid: string): Promise<DirectDebitMandate> {
    const mandate = await this.mandatesRepository.findOne({
      where: { userId, uuid },
    });
    if (mandate === null) {
      throw new AppException(
        ErrorCode.DirectDebitMandateNotFound,
        'Direct-debit mandate was not found.',
        404,
      );
    }

    return mandate;
  }

  async getResponseForUser(
    userId: number,
    uuid: string,
  ): Promise<DirectDebitMandateResponse> {
    return this.toResponse(await this.getForUser(userId, uuid));
  }

  async authorize(
    userId: number,
    uuid: string,
    dto: AuthorizeDirectDebitMandateDto,
  ): Promise<DirectDebitMandateResponse> {
    const mandate = await this.getForUser(userId, uuid);
    const provider = this.providerFactory.getProvider();
    const providerMandate = await provider.authorizeDirectDebitMandate({
      providerMandateId: mandate.providerMandateId,
      authorizationReference: dto.authorizationReference,
    });

    mandate.authorizationReference =
      providerMandate.authorizationReference ?? dto.authorizationReference;
    mandate.status = this.mapProviderStatus(providerMandate.status);
    mandate.failureReason = providerMandate.failureReason ?? null;
    if (mandate.status === DirectDebitMandateStatus.Active) {
      mandate.authorizedAt = new Date();
    }
    mandate.metadata = providerMandate.metadata;

    return this.toResponse(await this.mandatesRepository.save(mandate));
  }

  async revoke(
    userId: number,
    uuid: string,
    reason?: string,
  ): Promise<DirectDebitMandateResponse> {
    const mandate = await this.getForUser(userId, uuid);
    const providerMandate = await this.providerFactory
      .getProvider()
      .revokeDirectDebitMandate({
        providerMandateId: mandate.providerMandateId,
        reason,
      });

    mandate.status = this.mapProviderStatus(providerMandate.status);
    if (mandate.status === DirectDebitMandateStatus.Revoked) {
      mandate.revokedAt = new Date();
    }
    mandate.failureReason = providerMandate.failureReason ?? null;
    mandate.metadata = {
      ...mandate.metadata,
      ...providerMandate.metadata,
    };
    const savedMandate = await this.mandatesRepository.save(mandate);
    await this.settingsService.clearDefaultDirectDebitMandateIfMatches(
      userId,
      mandate.id,
    );
    return this.toResponse(savedMandate);
  }

  assertChargeableMandate(mandate: DirectDebitMandate, amount: number): void {
    try {
      assertMandateChargeable(mandate.status, mandate.expiresAt, new Date());
      assertMandateAmountAllowed(amount, Number(mandate.maximumAmount));
    } catch (error) {
      throw new AppException(
        ErrorCode.DirectDebitMandateNotActive,
        error instanceof Error
          ? error.message
          : 'Direct-debit mandate is not chargeable.',
        400,
      );
    }
  }

  private mapProviderStatus(
    status: ProviderDirectDebitMandate['status'],
  ): DirectDebitMandateStatus {
    switch (status) {
      case 'pending':
        return DirectDebitMandateStatus.Pending;
      case 'requires_authorization':
        return DirectDebitMandateStatus.RequiresAuthorization;
      case 'active':
        return DirectDebitMandateStatus.Active;
      case 'failed':
        return DirectDebitMandateStatus.Failed;
      case 'expired':
        return DirectDebitMandateStatus.Expired;
      case 'revoked':
        return DirectDebitMandateStatus.Revoked;
    }
  }

  toResponse(mandate: DirectDebitMandate): DirectDebitMandateResponse {
    return {
      uuid: mandate.uuid,
      provider: mandate.provider,
      bankName: mandate.bankName,
      accountName: mandate.accountName,
      accountNumberLastFour: mandate.accountNumberLastFour,
      bankCode: mandate.bankCode,
      currency: mandate.currency,
      maximumAmount: Number(mandate.maximumAmount),
      status: mandate.status,
      authorizedAt: mandate.authorizedAt,
      expiresAt: mandate.expiresAt,
      revokedAt: mandate.revokedAt,
      failureReason: mandate.failureReason,
      createdAt: mandate.createdAt,
      metadata: mandate.metadata
    };
  }
}
