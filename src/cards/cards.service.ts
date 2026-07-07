import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import {
  assertCardChargeable,
  assertCardRegistrationCanFinalize,
  assertCardRegistrationCanProceed,
} from './card-policy';
import { sanitizeCardProviderMetadata } from './card-metadata.util';
import {
  CreateCardRegistrationSessionDto,
  SubmitCardDetailsDto,
  SubmitCardOtpDto,
} from './dto/card-registration.dto';
import {
  CardRegistrationSession,
  CardRegistrationSessionStatus,
} from './entities/card-registration-session.entity';
import { Card, CardStatus } from './entities/card.entity';

export interface CardResponse {
  uuid: string;
  brand: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string | null;
  bankName: string | null;
  country: string | null;
  currency: string;
  isDefault: boolean;
  status: CardStatus;
  lastChargedAt: Date | null;
  createdAt: Date;
}

export interface CardRegistrationSessionResponse {
  reference: string;
  status: CardRegistrationSessionStatus;
  authorizationUrl: string | null;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  failureReason: string | null;
}

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private readonly cardsRepository: Repository<Card>,
    @InjectRepository(CardRegistrationSession)
    private readonly sessionsRepository: Repository<CardRegistrationSession>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}

  async createRegistrationSession(
    userUuid: string,
    dto: CreateCardRegistrationSessionDto,
  ): Promise<CardRegistrationSessionResponse> {
    const user = await this.usersService.getByUuid(userUuid);
    const publicProfile = await this.usersService.getPublicProfile(userUuid);
    const provider = this.providerFactory.getProvider();
    const providerSession = await provider.initializeCardRegistration({
      userUuid,
      email: dto.email?.trim().toLowerCase() ?? user.email,
      phoneNumber: user.phoneNumber,
    });

    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        reference: providerSession.reference || this.generateSessionReference(),
        userId: user.id,
        provider: providerSession.provider,
        authorizationUrl: providerSession.authorizationUrl ?? null,
        status: CardRegistrationSessionStatus.Created,
        cardId: null,
        failureReason: null,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        metadata: {
          ...sanitizeCardProviderMetadata(providerSession.metadata),
          currency:
            dto.currency?.toUpperCase() ??
            publicProfile.profile?.defaultCurrency ??
            'NGN',
        },
      }),
    );

    return this.toSessionResponse(session);
  }

  async submitRegistrationCardDetails(
    userUuid: string,
    reference: string,
    dto: SubmitCardDetailsDto,
  ): Promise<CardRegistrationSessionResponse> {
    const { session } = await this.getCompletableRegistrationSession(
      userUuid,
      reference,
    );
    const provider = this.providerFactory.getProvider();
    const result = await provider.submitCardDetails({
      reference,
      cardNumber: dto.cardNumber,
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      cvv: dto.cvv,
      cardholderName: dto.cardholderName,
      cardPin: dto.cardPin,
    });

    session.authorizationUrl =
      result.authorizationUrl ?? session.authorizationUrl;
    session.metadata = {
      ...session.metadata,
      ...sanitizeCardProviderMetadata(result.metadata),
      cardDetailsSubmittedAt: new Date().toISOString(),
    };

    if (result.status === 'failed') {
      session.status = CardRegistrationSessionStatus.Failed;
      session.failureReason =
        result.failureReason ?? 'Card registration failed.';
      await this.sessionsRepository.save(session);
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        session.failureReason,
        400,
      );
    }

    session.status = CardRegistrationSessionStatus.Pending;
    session.failureReason = null;
    await this.sessionsRepository.save(session);
    return this.toSessionResponse(session);
  }

  async submitRegistrationCardOtp(
    userUuid: string,
    reference: string,
    dto: SubmitCardOtpDto,
  ): Promise<CardResponse> {
    const { user, session } = await this.getCompletableRegistrationSession(
      userUuid,
      reference,
    );
    const provider = this.providerFactory.getProvider();
    const result = await provider.submitCardOtp({
      reference,
      otp: dto.otp,
      transactionId: this.readSessionTransactionId(session),
      phoneNumber: user.phoneNumber,
    });

    session.metadata = {
      ...session.metadata,
      ...sanitizeCardProviderMetadata(result.metadata),
      cardOtpSubmittedAt: new Date().toISOString(),
    };

    if (result.status === 'failed') {
      session.status = CardRegistrationSessionStatus.Failed;
      session.failureReason =
        result.failureReason ?? 'Card registration failed.';
      await this.sessionsRepository.save(session);
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        session.failureReason,
        400,
      );
    }

    if (result.status !== 'successful') {
      session.status = CardRegistrationSessionStatus.Pending;
      await this.sessionsRepository.save(session);
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        'Card registration is still pending.',
        400,
      );
    }

    session.status = CardRegistrationSessionStatus.Verified;
    session.failureReason = null;
    await this.sessionsRepository.save(session);

    return this.saveCompletedRegistrationCard(user, session);
  }

  async completeRegistrationSession(
    userUuid: string,
    reference: string,
  ): Promise<CardResponse> {
    const { user, session } = await this.getCompletableRegistrationSession(
      userUuid,
      reference,
    );

    return this.saveCompletedRegistrationCard(user, session);
  }

  async listForUser(userId: number): Promise<CardResponse[]> {
    const cards = await this.cardsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return cards.map((card) => this.toResponse(card));
  }

  async getForUser(userId: number, uuid: string): Promise<Card> {
    const card = await this.cardsRepository.findOne({
      where: { userId, uuid },
    });
    if (card === null) {
      throw new AppException(
        ErrorCode.CardNotFound,
        'Card was not found.',
        404,
      );
    }

    return card;
  }

  async getResponseForUser(
    userId: number,
    uuid: string,
  ): Promise<CardResponse> {
    return this.toResponse(await this.getForUser(userId, uuid));
  }

  async setDefault(userId: number, uuid: string): Promise<CardResponse> {
    const card = await this.getForUser(userId, uuid);
    this.assertChargeableCard(card);

    await this.cardsRepository.update({ userId }, { isDefault: false });
    card.isDefault = true;
    const savedCard = await this.cardsRepository.save(card);
    await this.settingsService.setDefaultCard(userId, savedCard.id);
    return this.toResponse(savedCard);
  }

  async disable(userId: number, uuid: string): Promise<CardResponse> {
    const card = await this.getForUser(userId, uuid);
    card.status = CardStatus.Disabled;
    card.isDefault = false;
    const savedCard = await this.cardsRepository.save(card);
    await this.settingsService.clearDefaultCardIfMatches(userId, card.id);
    return this.toResponse(savedCard);
  }

  async delete(userId: number, uuid: string): Promise<void> {
    const card = await this.getForUser(userId, uuid);
    card.status = CardStatus.Revoked;
    card.isDefault = false;
    await this.cardsRepository.save(card);
    await this.settingsService.clearDefaultCardIfMatches(userId, card.id);
  }

  assertChargeableCard(card: Card): void {
    try {
      assertCardChargeable(card.status);
    } catch (error) {
      throw new AppException(
        ErrorCode.CardNotActive,
        error instanceof Error ? error.message : 'Card is not active.',
        400,
      );
    }
  }

  async markCharged(card: Card): Promise<Card> {
    card.lastChargedAt = new Date();
    return this.cardsRepository.save(card);
  }

  toResponse(card: Card): CardResponse {
    return {
      uuid: card.uuid,
      brand: card.brand,
      lastFourDigits: card.lastFourDigits,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cardholderName: card.cardholderName,
      bankName: card.bankName,
      country: card.country,
      currency: card.currency,
      isDefault: card.isDefault,
      status: card.status,
      lastChargedAt: card.lastChargedAt,
      createdAt: card.createdAt,
    };
  }

  private async getCompletableRegistrationSession(
    userUuid: string,
    reference: string,
  ): Promise<{
    user: Awaited<ReturnType<UsersService['getByUuid']>>;
    session: CardRegistrationSession;
  }> {
    const user = await this.usersService.getByUuid(userUuid);
    const session = await this.sessionsRepository.findOne({
      where: { userId: user.id, reference },
    });

    if (session === null) {
      throw new NotFoundException('Card registration session was not found.');
    }

    try {
      assertCardRegistrationCanProceed(
        session.status,
        session.expiresAt,
        new Date(),
      );
    } catch (error) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        error instanceof Error
          ? error.message
          : 'Card registration session cannot be completed.',
        400,
      );
    }

    return { user, session };
  }

  private async saveCompletedRegistrationCard(
    user: Awaited<ReturnType<UsersService['getByUuid']>>,
    session: CardRegistrationSession,
  ): Promise<CardResponse> {
    try {
      assertCardRegistrationCanFinalize(
        session.status,
        session.expiresAt,
        new Date(),
      );
    } catch (error) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        error instanceof Error
          ? error.message
          : 'Card registration session cannot be finalized.',
        400,
      );
    }

    const provider = this.providerFactory.getProvider();
    const providerCard = await provider.completeCardRegistration({
      reference: session.reference,
    });
    const firstCard = await this.cardsRepository.count({
      where: { userId: user.id },
    });
    const currency = this.readSessionCurrency(session);
    const card = await this.cardsRepository.save(
      this.cardsRepository.create({
        userId: user.id,
        provider: providerCard.provider,
        providerCustomerId: providerCard.providerCustomerId,
        providerCardToken: providerCard.providerCardToken,
        authorizationReference: providerCard.authorizationReference,
        brand: providerCard.brand,
        lastFourDigits: providerCard.lastFourDigits,
        expiryMonth: providerCard.expiryMonth,
        expiryYear: providerCard.expiryYear,
        cardholderName: null,
        bankName: null,
        country: null,
        currency,
        isDefault: firstCard === 0,
        status: CardStatus.Active,
        lastChargedAt: null,
        metadata: sanitizeCardProviderMetadata(providerCard.metadata),
      }),
    );

    session.status = CardRegistrationSessionStatus.Completed;
    session.cardId = card.id;
    session.failureReason = null;
    await this.sessionsRepository.save(session);

    if (card.isDefault) {
      await this.settingsService.setDefaultCard(user.id, card.id);
    }

    return this.toResponse(card);
  }

  private toSessionResponse(
    session: CardRegistrationSession,
  ): CardRegistrationSessionResponse {
    return {
      reference: session.reference,
      status: session.status,
      authorizationUrl: session.authorizationUrl,
      expiresAt: session.expiresAt,
      metadata: sanitizeCardProviderMetadata(session.metadata),
      failureReason: session.failureReason,
    };
  }

  private readSessionCurrency(session: CardRegistrationSession): string {
    const currency = session.metadata.currency;
    return typeof currency === 'string' ? currency.toUpperCase() : 'NGN';
  }

  private readSessionTransactionId(
    session: CardRegistrationSession,
  ): string | undefined {
    const transactionId = session.metadata.transactionId;
    return typeof transactionId === 'string' ? transactionId : undefined;
  }

  private generateSessionReference(): string {
    return `crs_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  }
}
