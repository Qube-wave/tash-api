import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CardsService } from '../cards/cards.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderName } from '../config/payment-provider.config';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';
import {
  LedgerDirection,
  WalletLedgerEntry,
  WalletLedgerEntryType,
} from '../wallets/entities/wallet-ledger-entry.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import { VirtualAccountsService } from '../virtual-accounts/virtual-accounts.service';
import { MockVirtualAccountFundingWebhookDto } from './dto/mock-virtual-account-funding.dto';
import {
  WebhookEvent,
  WebhookEventStatus,
} from './entities/webhook-event.entity';

export interface WebhookProcessingResponse {
  accepted: true;
  duplicate: boolean;
  providerEventId?: string;
  eventType?: string;
  transactionReference?: string;
}

interface VirtualAccountFundingInput {
  provider: string;
  providerEventId: string;
  providerReference: string;
  providerAccountId?: string;
  accountNumber?: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    private readonly virtualAccountsService: VirtualAccountsService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly cardsService: CardsService,
  ) {}

  async processProviderWebhook(input: {
    providerName: PaymentProviderName;
    headers: Record<string, string | string[] | undefined>;
    rawBody: Buffer;
    payload: unknown;
  }): Promise<WebhookProcessingResponse> {
    const provider = this.providerFactory.getProviderByName(input.providerName);
    const verified = await provider.verifyWebhook(input.headers, input.rawBody);

    if (!verified) {
      throw new AppException(
        ErrorCode.InvalidWebhookSignature,
        'Invalid webhook signature.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const event = await provider.parseWebhook(input.payload);
    const existing = await this.webhookEventsRepository.findOne({
      where: {
        provider: event.provider,
        providerEventId: event.providerEventId,
      },
    });

    if (existing !== null) {
      return {
        accepted: true,
        duplicate: true,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
      };
    }

    const savedEvent = await this.webhookEventsRepository.save(
      this.webhookEventsRepository.create({
        provider: event.provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        signature: this.readHeader(
          input.headers,
          `${event.provider}-signature`,
        ),
        payload: event.payload,
        status: WebhookEventStatus.Received,
        processingAttempts: 0,
        lastError: null,
        processedAt: null,
      }),
    );

    let transactionReference: string | undefined;

    try {
      transactionReference = await this.applyProviderWebhook(savedEvent);
      savedEvent.status = WebhookEventStatus.Processed;
      savedEvent.processedAt = new Date();
      await this.webhookEventsRepository.save(savedEvent);
    } catch (error: unknown) {
      savedEvent.status = WebhookEventStatus.Failed;
      savedEvent.lastError =
        error instanceof Error ? error.message : 'Webhook processing failed.';
      await this.webhookEventsRepository.save(savedEvent);
      throw error;
    }

    this.logger.log('Payment provider webhook accepted', {
      provider: event.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
    });

    return {
      accepted: true,
      duplicate: false,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      transactionReference,
    };
  }

  async processMockVirtualAccountFunding(
    dto: MockVirtualAccountFundingWebhookDto,
  ): Promise<WebhookProcessingResponse> {
    const existing = await this.webhookEventsRepository.findOne({
      where: { provider: 'mock', providerEventId: dto.providerEventId },
    });

    if (existing !== null) {
      return { accepted: true, duplicate: true };
    }

    const event = await this.webhookEventsRepository.save(
      this.webhookEventsRepository.create({
        provider: 'mock',
        providerEventId: dto.providerEventId,
        eventType: 'virtual_account.funding.successful',
        signature: null,
        payload: dto as unknown as Record<string, unknown>,
        status: WebhookEventStatus.Received,
        processingAttempts: 0,
        lastError: null,
        processedAt: null,
      }),
    );

    try {
      const transactionReference = await this.applyVirtualAccountFunding({
        provider: 'mock',
        providerEventId: dto.providerEventId,
        providerReference: dto.providerReference,
        providerAccountId: dto.providerAccountId,
        accountNumber: dto.accountNumber,
        amount: dto.amount,
        currency: dto.currency,
      });
      event.status = WebhookEventStatus.Processed;
      event.processedAt = new Date();
      await this.webhookEventsRepository.save(event);
      return { accepted: true, duplicate: false, transactionReference };
    } catch (error) {
      event.status = WebhookEventStatus.Failed;
      event.lastError =
        error instanceof Error ? error.message : 'Webhook processing failed.';
      await this.webhookEventsRepository.save(event);
      throw error;
    }
  }

  private async applyProviderWebhook(
    event: WebhookEvent,
  ): Promise<string | undefined> {
    if (event.provider !== 'nomba') {
      return undefined;
    }

    const virtualAccountFunding = this.extractNombaVirtualAccountFunding(event);

    if (virtualAccountFunding !== null) {
      const transactionReference = await this.applyVirtualAccountFunding(
        virtualAccountFunding,
      );
      this.logger.log('Nomba virtual account funding webhook processed', {
        providerEventId: event.providerEventId,
        transactionReference,
      });
      return transactionReference;
    }

    const result =
      await this.cardsService.completeRegistrationFromProviderWebhook({
        provider: event.provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        payload: event.payload,
      });

    if (result.processed) {
      this.logger.log('Nomba tokenized card webhook processed', {
        providerEventId: event.providerEventId,
        reference: result.reference,
        cardUuid: result.cardUuid,
      });
      return undefined;
    }

    this.logger.log('Nomba webhook has no supported action', {
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      reason: result.reason,
      reference: result.reference,
    });

    return undefined;
  }

  private async applyVirtualAccountFunding(
    input: VirtualAccountFundingInput,
  ): Promise<string> {
    const account =
      await this.virtualAccountsService.findFundingAccountByProviderReference({
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        accountNumber: input.accountNumber,
      });

    if (account.currency !== input.currency.toUpperCase()) {
      throw new AppException(
        ErrorCode.TransferFailed,
        'Webhook currency does not match virtual account currency.',
        400,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsService.lockWallet(
        manager,
        account.walletId,
      );
      const balance = this.walletsService.creditLockedWallet(
        lockedWallet,
        input.amount,
      );
      const transaction = this.transactionsService.createEntity({
        userId: account.userId,
        walletId: lockedWallet.id,
        type: TransactionType.VirtualAccountFunding,
        direction: TransactionDirection.Credit,
        amount: input.amount,
        currency: input.currency,
        description: 'Virtual account funding',
        externalReference: input.providerReference,
        metadata: {
          virtualAccountUuid: account.uuid,
          providerEventId: input.providerEventId,
          providerReference: input.providerReference,
          ...(input.metadata ?? {}),
        },
      });
      transaction.provider = input.provider;
      transaction.providerReference = input.providerReference;
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Processing,
      );
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Successful,
      );
      const savedTransaction = await manager.save(transaction);
      await manager.save(Wallet, lockedWallet);
      const ledgerEntry = this.walletsService.createLedgerEntry({
        wallet: lockedWallet,
        transaction: savedTransaction,
        direction: LedgerDirection.Credit,
        entryType: WalletLedgerEntryType.VirtualAccountFunding,
        amount: input.amount,
        balanceBefore: balance.before,
        balanceAfter: balance.after,
        metadata: {
          virtualAccountUuid: account.uuid,
          providerEventId: input.providerEventId,
          providerReference: input.providerReference,
          ...(input.metadata ?? {}),
        },
      });
      await manager.save(WalletLedgerEntry, ledgerEntry);
      return savedTransaction.reference;
    });
  }

  private extractNombaVirtualAccountFunding(
    event: WebhookEvent,
  ): VirtualAccountFundingInput | null {
    if (event.eventType !== 'payment_success') {
      return null;
    }

    const data = this.asRecord(event.payload.data);
    const transaction = this.asRecord(data.transaction);
    const customer = this.asRecord(data.customer);
    const transactionType = this.readString(transaction.type);
    const aliasAccountType = this.readString(transaction.aliasAccountType);

    if (
      transactionType !== 'vact_transfer' &&
      aliasAccountType?.toUpperCase() !== 'VIRTUAL'
    ) {
      return null;
    }

    const amount = this.readAmount(transaction.transactionAmount);
    const providerReference = this.readString(transaction.transactionId);

    if (amount === undefined || providerReference === undefined) {
      this.logger.warn(
        'Nomba virtual account webhook missing required fields',
        {
          providerEventId: event.providerEventId,
          hasAmount: amount !== undefined,
          hasProviderReference: providerReference !== undefined,
        },
      );
      return null;
    }

    return {
      provider: event.provider,
      providerEventId: event.providerEventId,
      providerReference,
      providerAccountId: this.readString(transaction.aliasAccountReference),
      accountNumber: this.readString(transaction.aliasAccountNumber),
      amount,
      currency: 'NGN',
      metadata: {
        sessionId: this.readString(transaction.sessionId),
        narration: this.readString(transaction.narration),
        senderName: this.readString(customer.senderName),
        senderBankName: this.readString(customer.bankName),
        senderBankCode: this.readString(customer.bankCode),
        senderAccountNumberLastFour: this.readString(
          customer.accountNumber,
        )?.slice(-4),
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== ''
      ? value.trim()
      : undefined;
  }

  private readAmount(value: unknown): number | undefined {
    const amount =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(amount) || amount <= 0) {
      return undefined;
    }

    return Math.round(amount);
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | null {
    const value = headers[name] ?? headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
