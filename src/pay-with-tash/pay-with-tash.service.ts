import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CardsService } from '../cards/cards.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { DirectDebitService } from '../direct-debit/direct-debit.service';
import { MerchantWebhookService } from '../merchants/merchant-webhook.service';
import { MerchantsService } from '../merchants/merchants.service';
import { Merchant } from '../merchants/entities/merchant.entity';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { SettingsService } from '../settings/settings.service';
import {
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import {
  TransactionResponse,
  TransactionsService,
} from '../transactions/transactions.service';
import {
  LedgerDirection,
  WalletLedgerEntry,
  WalletLedgerEntryType,
} from '../wallets/entities/wallet-ledger-entry.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import {
  AuthorizePayWithTashSessionDto,
  CreatePayWithTashSessionDto,
  PayWithTashPaymentMethodType,
} from './dto/pay-with-tash.dto';
import {
  PayWithTashSession,
  PayWithTashSessionStatus,
} from './entities/pay-with-tash-session.entity';
import {
  assertRedirectUrlAllowed,
  assertSessionCanBeAuthorized,
} from './pay-with-tash-policy';

export interface PayWithTashSessionResponse {
  reference: string;
  status: PayWithTashSessionStatus;
  checkoutUrl: string;
  amount: number;
  currency: string;
  description: string | null;
  merchantReference: string;
  merchant: {
    merchantCode: string;
    displayName: string;
  };
  expiresAt: Date;
}

@Injectable()
export class PayWithTashService {
  constructor(
    @InjectRepository(PayWithTashSession)
    private readonly sessionsRepository: Repository<PayWithTashSession>,
    private readonly dataSource: DataSource,
    private readonly merchantsService: MerchantsService,
    private readonly walletsService: WalletsService,
    private readonly cardsService: CardsService,
    private readonly directDebitService: DirectDebitService,
    private readonly transactionsService: TransactionsService,
    private readonly settingsService: SettingsService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly merchantWebhookService: MerchantWebhookService,
  ) {}

  async createSession(
    merchant: Merchant,
    dto: CreatePayWithTashSessionDto,
  ): Promise<PayWithTashSessionResponse> {
    const settings = await this.merchantsService.getSettings(merchant.id);
    assertRedirectUrlAllowed(
      dto.redirectUrl ?? null,
      settings.allowedRedirectUrls,
    );

    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        reference: this.generateReference(),
        merchantId: merchant.id,
        userId: null,
        transactionId: null,
        amount: String(dto.amount),
        currency: dto.currency.toUpperCase(),
        description: dto.description ?? null,
        merchantReference: dto.merchantReference,
        callbackUrl: dto.callbackUrl ?? settings.callbackUrl,
        redirectUrl: dto.redirectUrl ?? null,
        status: PayWithTashSessionStatus.Created,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        metadata: {
          ...(dto.metadata ?? {}),
          customer: dto.customer ?? null,
        },
      }),
    );

    return this.toResponse(session, merchant);
  }

  async getPublicSession(
    reference: string,
  ): Promise<PayWithTashSessionResponse> {
    const session = await this.getSession(reference);
    return this.toResponse(
      session,
      await this.merchantsService.getMerchantById(session.merchantId),
    );
  }

  async getMerchantSession(
    merchantId: number,
    reference: string,
  ): Promise<PayWithTashSessionResponse> {
    const session = await this.sessionsRepository.findOne({
      where: { merchantId, reference },
    });
    if (session === null) {
      throw new AppException(
        ErrorCode.PayWithTashSessionNotFound,
        'Pay with Tash session was not found.',
        404,
      );
    }

    return this.toResponse(
      session,
      await this.merchantsService.getMerchantById(merchantId),
    );
  }

  async cancel(
    userId: number,
    reference: string,
  ): Promise<PayWithTashSessionResponse> {
    const session = await this.getSession(reference);
    if (session.userId !== null && session.userId !== userId) {
      throw new AppException(
        ErrorCode.PayWithTashSessionNotFound,
        'Pay with Tash session was not found.',
        404,
      );
    }

    if (
      session.status === PayWithTashSessionStatus.Successful ||
      session.status === PayWithTashSessionStatus.Failed
    ) {
      throw new AppException(
        ErrorCode.PayWithTashSessionAlreadyProcessed,
        'Session has already been processed.',
        400,
      );
    }

    session.userId = userId;
    session.status = PayWithTashSessionStatus.Cancelled;
    const savedSession = await this.sessionsRepository.save(session);
    await this.queueMerchantWebhook(
      session.merchantId,
      savedSession,
      null,
      'pay_with_tash.cancelled',
    );

    return this.toResponse(
      savedSession,
      await this.merchantsService.getMerchantById(session.merchantId),
    );
  }

  async authorize(
    userId: number,
    reference: string,
    dto: AuthorizePayWithTashSessionDto,
  ): Promise<PayWithTashSessionResponse> {
    const session = await this.getSession(reference);
    const merchant = await this.merchantsService.getMerchantById(
      session.merchantId,
    );
    const merchantSettings = await this.merchantsService.getSettings(
      merchant.id,
    );
    const paymentSettings =
      await this.settingsService.getPaymentSettings(userId);

    try {
      assertSessionCanBeAuthorized(
        session.status,
        session.expiresAt,
        new Date(),
      );
    } catch (error) {
      if (session.expiresAt <= new Date()) {
        session.status = PayWithTashSessionStatus.Expired;
        await this.sessionsRepository.save(session);
      }
      throw new AppException(
        session.expiresAt <= new Date()
          ? ErrorCode.PayWithTashSessionExpired
          : ErrorCode.PayWithTashSessionAlreadyProcessed,
        error instanceof Error
          ? error.message
          : 'Session cannot be authorized.',
        400,
      );
    }

    if (!paymentSettings.allowMerchantPayments) {
      throw new AppException(
        ErrorCode.MerchantNotActive,
        'Merchant payments are disabled for this user.',
        403,
      );
    }

    if (Number(session.amount) > paymentSettings.singleTransactionLimit) {
      throw new AppException(
        ErrorCode.TransactionLimitExceeded,
        'Transaction amount exceeds the single transaction limit.',
        400,
      );
    }

    await this.settingsService.validateTransactionPin(
      userId,
      dto.transactionPin,
    );

    switch (dto.paymentMethodType) {
      case PayWithTashPaymentMethodType.Wallet:
        if (
          !merchantSettings.allowWalletPayments ||
          !paymentSettings.allowWalletPayments
        ) {
          throw new AppException(
            ErrorCode.WalletRestricted,
            'Wallet payments are disabled for this checkout.',
            403,
          );
        }
        return this.authorizeWithWallet(
          userId,
          session,
          merchant,
          dto.paymentMethodUuid,
        );
      case PayWithTashPaymentMethodType.Card:
        if (
          !merchantSettings.allowCardPayments ||
          !paymentSettings.allowCardPayments
        ) {
          throw new AppException(
            ErrorCode.CardChargeFailed,
            'Card payments are disabled for this checkout.',
            403,
          );
        }
        return this.authorizeWithCard(
          userId,
          session,
          merchant,
          dto.paymentMethodUuid,
        );
      case PayWithTashPaymentMethodType.DirectDebit:
        if (
          !merchantSettings.allowDirectDebitPayments ||
          !paymentSettings.allowDirectDebitPayments
        ) {
          throw new AppException(
            ErrorCode.DirectDebitChargeFailed,
            'Direct-debit payments are disabled for this checkout.',
            403,
          );
        }
        return this.authorizeWithDirectDebit(
          userId,
          session,
          merchant,
          dto.paymentMethodUuid,
        );
    }
  }

  listMerchantTransactions(merchantId: number): Promise<TransactionResponse[]> {
    return this.transactionsService.listForMerchant(merchantId);
  }

  private async authorizeWithWallet(
    userId: number,
    session: PayWithTashSession,
    merchant: Merchant,
    walletUuid: string,
  ): Promise<PayWithTashSessionResponse> {
    const wallet = await this.walletsService.getForUser(userId, walletUuid);
    if (wallet.currency !== session.currency) {
      throw new AppException(
        ErrorCode.WalletRestricted,
        'Wallet currency does not match session currency.',
        400,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsService.lockWallet(
        manager,
        wallet.id,
      );
      const balance = this.walletsService.debitLockedWallet(
        lockedWallet,
        Number(session.amount),
      );
      const transaction = this.transactionsService.createEntity({
        userId,
        merchantId: merchant.id,
        walletId: lockedWallet.id,
        payWithTashSessionId: session.id,
        type: TransactionType.MerchantPayment,
        direction: TransactionDirection.Debit,
        amount: Number(session.amount),
        currency: session.currency,
        description: session.description,
        externalReference: session.merchantReference,
        metadata: {
          merchantCode: merchant.merchantCode,
          payWithTashReference: session.reference,
          paymentMethodType: PayWithTashPaymentMethodType.Wallet,
        },
      });
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Processing,
      );
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Successful,
      );
      const savedTransaction = await manager.save(Transaction, transaction);
      await manager.save(Wallet, lockedWallet);
      await manager.save(
        WalletLedgerEntry,
        this.walletsService.createLedgerEntry({
          wallet: lockedWallet,
          transaction: savedTransaction,
          direction: LedgerDirection.Debit,
          entryType: WalletLedgerEntryType.MerchantPayment,
          amount: Number(session.amount),
          balanceBefore: balance.before,
          balanceAfter: balance.after,
          metadata: {
            merchantCode: merchant.merchantCode,
            payWithTashReference: session.reference,
          },
        }),
      );
      session.userId = userId;
      session.transactionId = savedTransaction.id;
      session.status = PayWithTashSessionStatus.Successful;
      session.metadata = {
        ...session.metadata,
        transactionReference: savedTransaction.reference,
      };
      const savedSession = await manager.save(PayWithTashSession, session);
      await this.merchantsService.recordCustomerRelationship(
        merchant.id,
        userId,
      );
      await this.queueMerchantWebhook(
        merchant.id,
        savedSession,
        savedTransaction.reference,
        'pay_with_tash.successful',
      );
      return this.toResponse(savedSession, merchant);
    });
  }

  private async authorizeWithCard(
    userId: number,
    session: PayWithTashSession,
    merchant: Merchant,
    cardUuid: string,
  ): Promise<PayWithTashSessionResponse> {
    const card = await this.cardsService.getForUser(userId, cardUuid);
    this.cardsService.assertChargeableCard(card);
    if (card.currency !== session.currency) {
      throw new AppException(
        ErrorCode.CardChargeFailed,
        'Card currency does not match session currency.',
        400,
      );
    }

    const transaction = this.transactionsService.createEntity({
      userId,
      merchantId: merchant.id,
      cardId: card.id,
      payWithTashSessionId: session.id,
      type: TransactionType.MerchantPayment,
      direction: TransactionDirection.Debit,
      amount: Number(session.amount),
      currency: session.currency,
      description: session.description,
      externalReference: session.merchantReference,
      metadata: {
        merchantCode: merchant.merchantCode,
        payWithTashReference: session.reference,
        paymentMethodType: PayWithTashPaymentMethodType.Card,
        cardUuid,
      },
    });
    this.transactionsService.transition(
      transaction,
      TransactionStatus.Processing,
    );
    const savedTransaction = await this.transactionsService.save(transaction);

    session.userId = userId;
    session.transactionId = savedTransaction.id;
    session.status = PayWithTashSessionStatus.Processing;
    session.metadata = {
      ...session.metadata,
      transactionReference: savedTransaction.reference,
    };
    await this.sessionsRepository.save(session);

    const providerResult = await this.providerFactory.getProvider().chargeCard({
      amount: Number(session.amount),
      currency: session.currency,
      providerCardToken: card.providerCardToken,
      reference: savedTransaction.reference,
    });

    savedTransaction.provider = providerResult.provider;
    savedTransaction.providerReference = providerResult.providerReference;

    if (providerResult.status !== 'successful') {
      savedTransaction.failureReason =
        providerResult.failureReason ?? 'Card payment failed.';
      this.transactionsService.transition(
        savedTransaction,
        TransactionStatus.Failed,
      );
      await this.transactionsService.save(savedTransaction);
      session.status = PayWithTashSessionStatus.Failed;
      const savedSession = await this.sessionsRepository.save(session);
      await this.queueMerchantWebhook(
        merchant.id,
        savedSession,
        savedTransaction.reference,
        'pay_with_tash.failed',
      );
      throw new AppException(
        ErrorCode.CardChargeFailed,
        savedTransaction.failureReason,
        400,
      );
    }

    this.transactionsService.transition(
      savedTransaction,
      TransactionStatus.Successful,
    );
    const successfulTransaction =
      await this.transactionsService.save(savedTransaction);
    session.status = PayWithTashSessionStatus.Successful;
    const savedSession = await this.sessionsRepository.save(session);
    await this.cardsService.markCharged(card);
    await this.merchantsService.recordCustomerRelationship(merchant.id, userId);
    await this.queueMerchantWebhook(
      merchant.id,
      savedSession,
      successfulTransaction.reference,
      'pay_with_tash.successful',
    );
    return this.toResponse(savedSession, merchant);
  }

  private async authorizeWithDirectDebit(
    userId: number,
    session: PayWithTashSession,
    merchant: Merchant,
    mandateUuid: string,
  ): Promise<PayWithTashSessionResponse> {
    const mandate = await this.directDebitService.getForUser(
      userId,
      mandateUuid,
    );
    this.directDebitService.assertChargeableMandate(
      mandate,
      Number(session.amount),
    );
    if (mandate.currency !== session.currency) {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        'Direct-debit mandate currency does not match session currency.',
        400,
      );
    }

    const transaction = this.transactionsService.createEntity({
      userId,
      merchantId: merchant.id,
      directDebitMandateId: mandate.id,
      payWithTashSessionId: session.id,
      type: TransactionType.MerchantPayment,
      direction: TransactionDirection.Debit,
      amount: Number(session.amount),
      currency: session.currency,
      description: session.description,
      externalReference: session.merchantReference,
      metadata: {
        merchantCode: merchant.merchantCode,
        payWithTashReference: session.reference,
        paymentMethodType: PayWithTashPaymentMethodType.DirectDebit,
        mandateUuid,
      },
    });
    this.transactionsService.transition(
      transaction,
      TransactionStatus.Processing,
    );
    const savedTransaction = await this.transactionsService.save(transaction);

    session.userId = userId;
    session.transactionId = savedTransaction.id;
    session.status = PayWithTashSessionStatus.Processing;
    session.metadata = {
      ...session.metadata,
      transactionReference: savedTransaction.reference,
    };
    await this.sessionsRepository.save(session);

    const providerResult = await this.providerFactory
      .getProvider()
      .chargeDirectDebitMandate({
        providerMandateId: mandate.providerMandateId,
        amount: Number(session.amount),
        currency: session.currency,
        reference: savedTransaction.reference,
      });

    savedTransaction.provider = providerResult.provider;
    savedTransaction.providerReference = providerResult.providerReference;

    if (providerResult.status !== 'successful') {
      savedTransaction.failureReason =
        providerResult.failureReason ?? 'Direct-debit payment failed.';
      this.transactionsService.transition(
        savedTransaction,
        TransactionStatus.Failed,
      );
      await this.transactionsService.save(savedTransaction);
      session.status = PayWithTashSessionStatus.Failed;
      const savedSession = await this.sessionsRepository.save(session);
      await this.queueMerchantWebhook(
        merchant.id,
        savedSession,
        savedTransaction.reference,
        'pay_with_tash.failed',
      );
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        savedTransaction.failureReason,
        400,
      );
    }

    this.transactionsService.transition(
      savedTransaction,
      TransactionStatus.Successful,
    );
    const successfulTransaction =
      await this.transactionsService.save(savedTransaction);
    session.status = PayWithTashSessionStatus.Successful;
    const savedSession = await this.sessionsRepository.save(session);
    await this.merchantsService.recordCustomerRelationship(merchant.id, userId);
    await this.queueMerchantWebhook(
      merchant.id,
      savedSession,
      successfulTransaction.reference,
      'pay_with_tash.successful',
    );
    return this.toResponse(savedSession, merchant);
  }

  private async getSession(reference: string): Promise<PayWithTashSession> {
    const session = await this.sessionsRepository.findOne({
      where: { reference },
    });
    if (session === null) {
      throw new AppException(
        ErrorCode.PayWithTashSessionNotFound,
        'Pay with Tash session was not found.',
        404,
      );
    }
    return session;
  }

  private async queueMerchantWebhook(
    merchantId: number,
    session: PayWithTashSession,
    transactionReference: string | null,
    eventType: string,
  ): Promise<void> {
    const settings = await this.merchantsService.getSettings(merchantId);
    await this.merchantWebhookService.createDelivery({
      merchantId,
      settings,
      eventType,
      data: {
        reference: session.reference,
        merchantReference: session.merchantReference,
        transactionReference,
        amount: Number(session.amount),
        currency: session.currency,
        status: session.status,
      },
    });
  }

  private toResponse(
    session: PayWithTashSession,
    merchant: Merchant,
  ): PayWithTashSessionResponse {
    return {
      reference: session.reference,
      status: session.status,
      checkoutUrl: `https://tash.example.com/pay/${session.reference}`,
      amount: Number(session.amount),
      currency: session.currency,
      description: session.description,
      merchantReference: session.merchantReference,
      merchant: {
        merchantCode: merchant.merchantCode,
        displayName: merchant.displayName,
      },
      expiresAt: session.expiresAt,
    };
  }

  private generateReference(): string {
    return `pwt_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  }
}
