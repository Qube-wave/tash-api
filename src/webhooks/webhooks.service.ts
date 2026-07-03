import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
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
  transactionReference?: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    private readonly virtualAccountsService: VirtualAccountsService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

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
      const transactionReference = await this.applyVirtualAccountFunding(dto);
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

  private async applyVirtualAccountFunding(
    dto: MockVirtualAccountFundingWebhookDto,
  ): Promise<string> {
    const account =
      await this.virtualAccountsService.findFundingAccountByProviderReference({
        provider: 'mock',
        providerAccountId: dto.providerAccountId,
        accountNumber: dto.accountNumber,
      });

    if (account.currency !== dto.currency.toUpperCase()) {
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
        dto.amount,
      );
      const transaction = this.transactionsService.createEntity({
        userId: account.userId,
        walletId: lockedWallet.id,
        type: TransactionType.VirtualAccountFunding,
        direction: TransactionDirection.Credit,
        amount: dto.amount,
        currency: dto.currency,
        description: 'Virtual account funding',
        externalReference: dto.providerReference,
        metadata: {
          virtualAccountUuid: account.uuid,
          providerEventId: dto.providerEventId,
          providerReference: dto.providerReference,
        },
      });
      transaction.provider = 'mock';
      transaction.providerReference = dto.providerReference;
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
        amount: dto.amount,
        balanceBefore: balance.before,
        balanceAfter: balance.after,
        metadata: {
          virtualAccountUuid: account.uuid,
          providerEventId: dto.providerEventId,
          providerReference: dto.providerReference,
        },
      });
      await manager.save(WalletLedgerEntry, ledgerEntry);
      return savedTransaction.reference;
    });
  }
}
