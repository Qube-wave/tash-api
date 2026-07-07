import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type {
  ProviderCardRegistrationStep,
  SubmitCardDetailsInput,
  SubmitCardOtpInput,
  ResendCardOtpInput,
} from '../payment-providers/interfaces/payment-provider.interface';
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

export interface CardTokenizationWebhookResult {
  processed: boolean;
  reference?: string;
  cardUuid?: string;
  reason?: string;
}

type CardRegistrationProviderPhase = 'card_details' | 'otp' | 'resend_otp';

const GENERIC_CARD_DETAILS_FAILURE_MESSAGE =
  'Card connection failed. Please check the card details and try again.';
const GENERIC_CARD_OTP_FAILURE_MESSAGE =
  'Card verification failed. Please check the OTP and try again.';
const GENERIC_CARD_OTP_RESEND_FAILURE_MESSAGE =
  'Card OTP could not be resent. Please try again.';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

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
    const result = await this.submitProviderCardDetailsSafely(session, {
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
      await this.failProviderPhaseWithGenericResponse(
        session,
        'card_details',
        GENERIC_CARD_DETAILS_FAILURE_MESSAGE,
        {
          failureReason: result.failureReason,
          metadata: sanitizeCardProviderMetadata(result.metadata),
          provider: result.provider,
          status: result.status,
        },
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
    const result = await this.submitProviderCardOtpSafely(session, {
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
      await this.failProviderPhaseWithGenericResponse(
        session,
        'otp',
        GENERIC_CARD_OTP_FAILURE_MESSAGE,
        {
          failureReason: result.failureReason,
          metadata: sanitizeCardProviderMetadata(result.metadata),
          provider: result.provider,
          status: result.status,
        },
      );
    }

    if (result.status !== 'successful') {
      this.logProviderPhaseFailure(session, 'otp', {
        metadata: sanitizeCardProviderMetadata(result.metadata),
        provider: result.provider,
        status: result.status,
      });
      session.status = CardRegistrationSessionStatus.Pending;
      await this.sessionsRepository.save(session);
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        GENERIC_CARD_OTP_FAILURE_MESSAGE,
        400,
      );
    }

    session.status = CardRegistrationSessionStatus.Verified;
    session.failureReason = null;
    await this.sessionsRepository.save(session);

    return this.saveCompletedRegistrationCard(user, session);
  }

  async resendRegistrationCardOtp(
    userUuid: string,
    reference: string,
  ): Promise<CardRegistrationSessionResponse> {
    const { session } = await this.getCompletableRegistrationSession(
      userUuid,
      reference,
    );
    const result = await this.resendProviderCardOtpSafely(session, {
      reference,
      transactionId: this.readSessionTransactionId(session),
    });

    session.metadata = {
      ...session.metadata,
      ...sanitizeCardProviderMetadata(result.metadata),
      cardOtpResentAt: new Date().toISOString(),
    };

    if (result.status === 'failed') {
      await this.failProviderPhaseWithGenericResponse(
        session,
        'resend_otp',
        GENERIC_CARD_OTP_RESEND_FAILURE_MESSAGE,
        {
          failureReason: result.failureReason,
          metadata: sanitizeCardProviderMetadata(result.metadata),
          provider: result.provider,
          status: result.status,
        },
      );
    }

    session.status = CardRegistrationSessionStatus.Pending;
    session.failureReason = null;
    await this.sessionsRepository.save(session);
    return this.toSessionResponse(session);
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

  async completeRegistrationFromProviderWebhook(input: {
    provider: string;
    providerEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<CardTokenizationWebhookResult> {
    if (input.provider !== 'nomba' || input.eventType !== 'payment_success') {
      return { processed: false, reason: 'unsupported_event' };
    }

    const tokenizedCard = this.readNombaTokenizedCard(input.payload);
    const orderReference = this.readNombaWebhookOrderReference(input.payload);

    if (orderReference === undefined) {
      return { processed: false, reason: 'missing_order_reference' };
    }

    const tokenKey = this.readString(tokenizedCard.tokenKey);
    if (tokenKey === undefined || tokenKey.toUpperCase() === 'N/A') {
      return {
        processed: false,
        reference: orderReference,
        reason: 'missing_token_key',
      };
    }

    const session = await this.sessionsRepository.findOne({
      where: { provider: 'nomba', reference: orderReference },
    });

    if (session === null) {
      return {
        processed: false,
        reference: orderReference,
        reason: 'registration_session_not_found',
      };
    }

    if (
      session.status === CardRegistrationSessionStatus.Completed &&
      session.cardId !== null
    ) {
      const existingCard = await this.cardsRepository.findOne({
        where: { id: session.cardId },
      });

      return {
        processed: true,
        reference: orderReference,
        cardUuid: existingCard?.uuid,
      };
    }

    if (session.status === CardRegistrationSessionStatus.Failed) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        'Card registration session has already failed.',
        400,
      );
    }

    const card = await this.saveTokenizedRegistrationCardFromWebhook(
      session,
      tokenizedCard,
      input.payload,
      input.providerEventId,
    );

    return {
      processed: true,
      reference: orderReference,
      cardUuid: card.uuid,
    };
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

  private async saveTokenizedRegistrationCardFromWebhook(
    session: CardRegistrationSession,
    tokenizedCard: Record<string, unknown>,
    payload: Record<string, unknown>,
    providerEventId: string,
  ): Promise<Card> {
    const order = this.readRecord(this.readRecord(payload.data).order);
    const transaction = this.readRecord(
      this.readRecord(payload.data).transaction,
    );
    const expiry = this.parseTokenizedCardExpiry(tokenizedCard);
    const firstCard = await this.cardsRepository.count({
      where: { userId: session.userId },
    });
    const tokenKey = this.readString(tokenizedCard.tokenKey);

    if (tokenKey === undefined) {
      throw new AppException(
        ErrorCode.CardRegistrationFailed,
        'Nomba webhook did not include a tokenized card token.',
        400,
      );
    }

    const card = await this.cardsRepository.save(
      this.cardsRepository.create({
        userId: session.userId,
        provider: 'nomba',
        providerCustomerId:
          this.readString(tokenizedCard.customerEmail) ??
          this.readString(order.customerEmail) ??
          tokenKey,
        providerCardToken: tokenKey,
        authorizationReference: session.reference,
        brand:
          this.readString(tokenizedCard.cardType)?.toLowerCase() ?? 'unknown',
        lastFourDigits: this.extractLastFourDigits(
          this.readString(tokenizedCard.cardPan),
        ),
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        cardholderName: null,
        bankName: null,
        country: null,
        currency:
          this.readString(order.currency)?.toUpperCase() ??
          this.readSessionCurrency(session),
        isDefault: firstCard === 0,
        status: CardStatus.Active,
        lastChargedAt: null,
        metadata: sanitizeCardProviderMetadata({
          tokenizedCardData: tokenizedCard,
          orderReference: session.reference,
          providerEventId,
          transactionId: this.readString(transaction.transactionId),
          merchantTxRef: this.readString(transaction.merchantTxRef),
          tokenizedViaWebhookAt: new Date().toISOString(),
        }),
      }),
    );

    session.status = CardRegistrationSessionStatus.Completed;
    session.cardId = card.id;
    session.failureReason = null;
    session.metadata = {
      ...session.metadata,
      ...sanitizeCardProviderMetadata({
        providerEventId,
        transactionId: this.readString(transaction.transactionId),
        merchantTxRef: this.readString(transaction.merchantTxRef),
        tokenizedViaWebhookAt: new Date().toISOString(),
      }),
    };
    await this.sessionsRepository.save(session);

    if (card.isDefault) {
      await this.settingsService.setDefaultCard(session.userId, card.id);
    }

    return card;
  }

  private async submitProviderCardDetailsSafely(
    session: CardRegistrationSession,
    input: SubmitCardDetailsInput,
  ): Promise<ProviderCardRegistrationStep> {
    const provider = this.providerFactory.getProvider();
    try {
      return await provider.submitCardDetails(input);
    } catch (error: unknown) {
      return await this.failProviderPhaseWithGenericResponse(
        session,
        'card_details',
        GENERIC_CARD_DETAILS_FAILURE_MESSAGE,
        this.serializeError(error),
      );
    }
  }

  private async submitProviderCardOtpSafely(
    session: CardRegistrationSession,
    input: SubmitCardOtpInput,
  ): Promise<ProviderCardRegistrationStep> {
    const provider = this.providerFactory.getProvider();
    try {
      return await provider.submitCardOtp(input);
    } catch (error: unknown) {
      return await this.failProviderPhaseWithGenericResponse(
        session,
        'otp',
        GENERIC_CARD_OTP_FAILURE_MESSAGE,
        this.serializeError(error),
      );
    }
  }

  private async resendProviderCardOtpSafely(
    session: CardRegistrationSession,
    input: ResendCardOtpInput,
  ): Promise<ProviderCardRegistrationStep> {
    const provider = this.providerFactory.getProvider();
    try {
      return await provider.resendCardOtp(input);
    } catch (error: unknown) {
      return await this.failProviderPhaseWithGenericResponse(
        session,
        'resend_otp',
        GENERIC_CARD_OTP_RESEND_FAILURE_MESSAGE,
        this.serializeError(error),
      );
    }
  }

  private async failProviderPhaseWithGenericResponse(
    session: CardRegistrationSession,
    phase: CardRegistrationProviderPhase,
    message: string,
    error: unknown,
  ): Promise<never> {
    this.logProviderPhaseFailure(session, phase, error);
    session.status = CardRegistrationSessionStatus.Failed;
    session.failureReason = message;
    await this.sessionsRepository.save(session);

    throw new AppException(ErrorCode.CardRegistrationFailed, message, 400);
  }

  private logProviderPhaseFailure(
    session: CardRegistrationSession,
    phase: CardRegistrationProviderPhase,
    error: unknown,
  ): void {
    this.logger.error('Card registration provider phase failed', {
      error,
      phase,
      reference: session.reference,
      sessionId: session.id,
      userId: session.userId,
    });
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof AppException) {
      return {
        response: error.getResponse(),
        status: error.getStatus(),
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return { message: String(error) };
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

  private readNombaTokenizedCard(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.readRecord(this.readRecord(payload.data).tokenizedCardData);
  }

  private readNombaWebhookOrderReference(
    payload: Record<string, unknown>,
  ): string | undefined {
    const data = this.readRecord(payload.data);
    const order = this.readRecord(data.order);
    const transaction = this.readRecord(data.transaction);

    return (
      this.readString(order.orderReference) ??
      this.readString(transaction.merchantTxRef) ??
      this.readString(payload.orderReference)
    );
  }

  private parseTokenizedCardExpiry(tokenizedCard: Record<string, unknown>): {
    month: string;
    year: string;
  } {
    const expiryDate = this.readString(tokenizedCard.tokenExpirationDate);
    if (expiryDate !== undefined && expiryDate.toUpperCase() !== 'N/A') {
      const [first, second] = expiryDate.split('/').map((part) => part.trim());
      const firstNumber = Number(first);
      const secondNumber = Number(second);

      if (
        Number.isInteger(firstNumber) &&
        firstNumber >= 1 &&
        firstNumber <= 12
      ) {
        return {
          month: String(firstNumber).padStart(2, '0'),
          year:
            second !== undefined && second.length === 2
              ? `20${second}`
              : (second ?? '2099'),
        };
      }

      if (
        Number.isInteger(secondNumber) &&
        secondNumber >= 1 &&
        secondNumber <= 12
      ) {
        return {
          month: String(secondNumber).padStart(2, '0'),
          year:
            first !== undefined && first.length === 2
              ? `20${first}`
              : (first ?? '2099'),
        };
      }
    }

    const tokenExpiryMonth = this.readString(tokenizedCard.tokenExpiryMonth);
    const tokenExpiryYear = this.readString(tokenizedCard.tokenExpiryYear);

    return {
      month:
        tokenExpiryMonth !== undefined &&
        tokenExpiryMonth.toUpperCase() !== 'N/A'
          ? tokenExpiryMonth.padStart(2, '0')
          : '12',
      year:
        tokenExpiryYear !== undefined && tokenExpiryYear.toUpperCase() !== 'N/A'
          ? tokenExpiryYear
          : '2099',
    };
  }

  private readRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== ''
      ? value.trim()
      : undefined;
  }

  private extractLastFourDigits(maskedPan: string | undefined): string {
    const digits = maskedPan?.replace(/\D/g, '') ?? '';
    return digits.slice(-4).padStart(4, '0');
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
