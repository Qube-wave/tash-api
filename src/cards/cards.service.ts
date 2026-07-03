import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { UsersService } from '../users/users.service';
import {
  assertCardChargeable,
  assertCardRegistrationCanComplete,
} from './card-policy';
import { CreateCardRegistrationSessionDto } from './dto/card-registration.dto';
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
      email: user.email,
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
          ...providerSession.metadata,
          currency:
            dto.currency?.toUpperCase() ??
            publicProfile.profile?.defaultCurrency ??
            'NGN',
        },
      }),
    );

    return this.toSessionResponse(session);
  }

  async completeRegistrationSession(
    userUuid: string,
    reference: string,
  ): Promise<CardResponse> {
    const user = await this.usersService.getByUuid(userUuid);
    const session = await this.sessionsRepository.findOne({
      where: { userId: user.id, reference },
    });

    if (session === null) {
      throw new NotFoundException('Card registration session was not found.');
    }

    try {
      assertCardRegistrationCanComplete(
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

    const provider = this.providerFactory.getProvider();
    const providerCard = await provider.completeCardRegistration({ reference });
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
        metadata: providerCard.metadata,
      }),
    );

    session.status = CardRegistrationSessionStatus.Completed;
    session.cardId = card.id;
    await this.sessionsRepository.save(session);

    return this.toResponse(card);
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
    return this.toResponse(await this.cardsRepository.save(card));
  }

  async disable(userId: number, uuid: string): Promise<CardResponse> {
    const card = await this.getForUser(userId, uuid);
    card.status = CardStatus.Disabled;
    card.isDefault = false;
    return this.toResponse(await this.cardsRepository.save(card));
  }

  async delete(userId: number, uuid: string): Promise<void> {
    const card = await this.getForUser(userId, uuid);
    card.status = CardStatus.Revoked;
    card.isDefault = false;
    await this.cardsRepository.save(card);
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

  private toSessionResponse(
    session: CardRegistrationSession,
  ): CardRegistrationSessionResponse {
    return {
      reference: session.reference,
      status: session.status,
      authorizationUrl: session.authorizationUrl,
      expiresAt: session.expiresAt,
      metadata: session.metadata,
    };
  }

  private readSessionCurrency(session: CardRegistrationSession): string {
    const currency = session.metadata.currency;
    return typeof currency === 'string' ? currency.toUpperCase() : 'NGN';
  }

  private generateSessionReference(): string {
    return `crs_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  }
}
