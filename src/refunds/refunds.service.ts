import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { MerchantWebhookService } from '../merchants/merchant-webhook.service';
import { MerchantsService } from '../merchants/merchants.service';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import {
  Transaction,
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
import { CreateRefundDto, RefundResponse } from './dto/refund.dto';
import {
  Refund,
  RefundDestinationType,
  RefundStatus,
} from './entities/refund.entity';
import {
  assertRefundAmountAllowed,
  assertRefundableTransaction,
  isRefundAmountReserved,
} from './refund-policy';

interface RefundCreationInput {
  merchantId: number | null;
  transactionUuid: string;
  dto: CreateRefundDto;
}

interface ReservedRefund {
  refund: Refund;
  transaction: Transaction;
  originalTransaction: Transaction;
}

@Injectable()
export class RefundsService {
  constructor(
    @InjectRepository(Refund)
    private readonly refundsRepository: Repository<Refund>,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly walletsService: WalletsService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly auditLogsService: AuditLogsService,
    private readonly merchantsService: MerchantsService,
    private readonly merchantWebhookService: MerchantWebhookService,
  ) {}

  async createMerchantRefund(
    merchantId: number,
    transactionUuid: string,
    dto: CreateRefundDto,
  ): Promise<RefundResponse> {
    const response = await this.createRefund({
      merchantId,
      transactionUuid,
      dto,
    });
    await this.auditLogsService.record({
      merchantId,
      action: 'refund.create.merchant',
      resourceType: 'refund',
      resourceId: response.uuid,
      metadata: {
        transactionUuid,
        amount: response.amount,
        currency: response.currency,
        destinationType: response.destinationType,
      },
    });
    return response;
  }

  async createAdminRefund(
    adminUserId: number,
    transactionUuid: string,
    dto: CreateRefundDto,
  ): Promise<RefundResponse> {
    const response = await this.createRefund({
      merchantId: null,
      transactionUuid,
      dto,
    });
    await this.auditLogsService.record({
      userId: adminUserId,
      merchantId: response.transactionMerchantId,
      action: 'refund.create.admin',
      resourceType: 'refund',
      resourceId: response.uuid,
      metadata: {
        transactionUuid,
        amount: response.amount,
        currency: response.currency,
        destinationType: response.destinationType,
      },
    });
    return response;
  }

  async listForUser(userId: number): Promise<RefundResponse[]> {
    const refunds = await this.refundsRepository.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 50,
    });
    return refunds.map((refund) => this.toResponse(refund));
  }

  async getForUser(userId: number, uuid: string): Promise<RefundResponse> {
    const refund = await this.refundsRepository.findOne({
      where: { userId, uuid },
    });
    if (refund === null) {
      throw new AppException(ErrorCode.NotFound, 'Refund was not found.', 404);
    }
    return this.toResponse(refund);
  }

  async listForMerchant(merchantId: number): Promise<RefundResponse[]> {
    const refunds = await this.refundsRepository.find({
      where: { merchantId },
      order: { id: 'DESC' },
      take: 50,
    });
    return refunds.map((refund) => this.toResponse(refund));
  }

  async getForMerchant(
    merchantId: number,
    uuid: string,
  ): Promise<RefundResponse> {
    const refund = await this.refundsRepository.findOne({
      where: { merchantId, uuid },
    });
    if (refund === null) {
      throw new AppException(ErrorCode.NotFound, 'Refund was not found.', 404);
    }
    return this.toResponse(refund);
  }

  private async createRefund(
    input: RefundCreationInput,
  ): Promise<RefundResponse> {
    switch (input.dto.destinationType) {
      case RefundDestinationType.Wallet:
        return this.createWalletRefund(input);
      case RefundDestinationType.OriginalPaymentMethod:
        return this.createOriginalPaymentMethodRefund(input);
      case RefundDestinationType.VirtualAccount:
        throw new AppException(
          ErrorCode.RefundFailed,
          'Virtual-account refunds are not supported in this phase.',
          400,
        );
    }
  }

  private async createWalletRefund(
    input: RefundCreationInput,
  ): Promise<RefundResponse> {
    const savedRefund = await this.dataSource.transaction(async (manager) => {
      const original = await this.lockOriginalTransaction(manager, input);
      await this.assertCanRefund(manager, original, input.dto.amount);
      const wallet = await this.walletsService.lockUserWalletByCurrency(
        manager,
        original.userId,
        original.currency,
      );
      const refundTransaction = this.createRefundTransaction(
        original,
        input.dto,
      );
      refundTransaction.walletId = wallet.id;
      this.transactionsService.transition(
        refundTransaction,
        TransactionStatus.Processing,
      );
      this.transactionsService.transition(
        refundTransaction,
        TransactionStatus.Successful,
      );
      const savedTransaction = await manager.save(
        Transaction,
        refundTransaction,
      );
      const balance = this.walletsService.creditLockedWallet(
        wallet,
        input.dto.amount,
      );
      await manager.save(Wallet, wallet);
      await manager.save(
        WalletLedgerEntry,
        this.walletsService.createLedgerEntry({
          wallet,
          transaction: savedTransaction,
          direction: LedgerDirection.Credit,
          entryType: WalletLedgerEntryType.RefundReceived,
          amount: input.dto.amount,
          balanceBefore: balance.before,
          balanceAfter: balance.after,
          metadata: {
            originalTransactionReference: original.reference,
            refundDestinationType: input.dto.destinationType,
          },
        }),
      );
      const refund = await manager.save(
        Refund,
        this.refundsRepository.create({
          transactionId: original.id,
          parentRefundId: null,
          userId: original.userId,
          merchantId: original.merchantId,
          walletId: wallet.id,
          provider: null,
          providerReference: null,
          reference: this.generateReference(),
          amount: String(input.dto.amount),
          currency: original.currency,
          destinationType: input.dto.destinationType,
          destinationReference: wallet.uuid,
          reason: input.dto.reason ?? null,
          status: RefundStatus.Successful,
          failureReason: null,
          processedAt: new Date(),
        }),
      );
      await this.updateOriginalRefundStatus(manager, original, 0);
      return refund;
    });

    await this.queueMerchantRefundWebhook(savedRefund, 'refund.successful');
    return this.toResponse(savedRefund);
  }

  private async createOriginalPaymentMethodRefund(
    input: RefundCreationInput,
  ): Promise<RefundResponse> {
    const reserved = await this.reserveProviderRefund(input);
    await this.queueMerchantRefundWebhook(reserved.refund, 'refund.processing');

    if (reserved.originalTransaction.providerReference === null) {
      const failed = await this.markProviderRefundFailed(
        reserved,
        'Original transaction does not have a provider reference.',
      );
      await this.queueMerchantRefundWebhook(failed, 'refund.failed');
      throw new AppException(
        ErrorCode.RefundFailed,
        failed.failureReason ?? 'Refund failed.',
        400,
      );
    }

    const providerResult = await this.providerFactory
      .getProvider()
      .refundPayment({
        providerReference: reserved.originalTransaction.providerReference,
        amount: Number(reserved.refund.amount),
        currency: reserved.refund.currency,
        reference: reserved.refund.reference,
      });

    if (providerResult.status === 'failed') {
      const failed = await this.markProviderRefundFailed(
        reserved,
        providerResult.failureReason ?? 'Provider refund failed.',
        providerResult.provider,
        providerResult.providerReference,
      );
      await this.queueMerchantRefundWebhook(failed, 'refund.failed');
      throw new AppException(
        ErrorCode.RefundFailed,
        failed.failureReason ?? 'Refund failed.',
        400,
      );
    }

    if (providerResult.status === 'pending') {
      reserved.refund.provider = providerResult.provider;
      reserved.refund.providerReference = providerResult.providerReference;
      reserved.refund.status = RefundStatus.Processing;
      const processing = await this.refundsRepository.save(reserved.refund);
      return this.toResponse(processing);
    }

    const successful = await this.markProviderRefundSuccessful(
      reserved,
      providerResult.provider,
      providerResult.providerReference,
    );
    await this.queueMerchantRefundWebhook(successful, 'refund.successful');
    return this.toResponse(successful);
  }

  private async reserveProviderRefund(
    input: RefundCreationInput,
  ): Promise<ReservedRefund> {
    return this.dataSource.transaction(async (manager) => {
      const original = await this.lockOriginalTransaction(manager, input);
      await this.assertCanRefund(manager, original, input.dto.amount);
      const refundTransaction = this.createRefundTransaction(
        original,
        input.dto,
      );
      this.transactionsService.transition(
        refundTransaction,
        TransactionStatus.Processing,
      );
      const savedTransaction = await manager.save(
        Transaction,
        refundTransaction,
      );
      const refund = await manager.save(
        Refund,
        this.refundsRepository.create({
          transactionId: original.id,
          parentRefundId: null,
          userId: original.userId,
          merchantId: original.merchantId,
          walletId: null,
          provider: null,
          providerReference: null,
          reference: this.generateReference(),
          amount: String(input.dto.amount),
          currency: original.currency,
          destinationType: input.dto.destinationType,
          destinationReference: original.providerReference,
          reason: input.dto.reason ?? null,
          status: RefundStatus.Processing,
          failureReason: null,
          processedAt: null,
        }),
      );
      return {
        refund,
        transaction: savedTransaction,
        originalTransaction: original,
      };
    });
  }

  private async markProviderRefundSuccessful(
    reserved: ReservedRefund,
    provider: string,
    providerReference: string,
  ): Promise<Refund> {
    return this.dataSource.transaction(async (manager) => {
      const refund = await this.lockRefund(manager, reserved.refund.id);
      const original = await manager.findOne(Transaction, {
        where: { id: refund.transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (original === null) {
        throw new AppException(
          ErrorCode.TransactionNotFound,
          'Transaction was not found.',
          404,
        );
      }
      const transaction = await manager.findOne(Transaction, {
        where: { id: reserved.transaction.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (transaction === null) {
        throw new AppException(
          ErrorCode.TransactionNotFound,
          'Transaction was not found.',
          404,
        );
      }
      refund.provider = provider;
      refund.providerReference = providerReference;
      refund.status = RefundStatus.Successful;
      refund.processedAt = new Date();
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Successful,
      );
      await manager.save(Transaction, transaction);
      await this.updateOriginalRefundStatus(
        manager,
        original,
        Number(refund.amount),
      );
      return manager.save(Refund, refund);
    });
  }

  private async markProviderRefundFailed(
    reserved: ReservedRefund,
    failureReason: string,
    provider: string | null = null,
    providerReference: string | null = null,
  ): Promise<Refund> {
    return this.dataSource.transaction(async (manager) => {
      const refund = await this.lockRefund(manager, reserved.refund.id);
      const transaction = await manager.findOne(Transaction, {
        where: { id: reserved.transaction.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (transaction === null) {
        throw new AppException(
          ErrorCode.TransactionNotFound,
          'Transaction was not found.',
          404,
        );
      }
      refund.provider = provider;
      refund.providerReference = providerReference;
      refund.status = RefundStatus.Failed;
      refund.failureReason = failureReason;
      refund.processedAt = new Date();
      transaction.failureReason = failureReason;
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Failed,
      );
      await manager.save(Transaction, transaction);
      return manager.save(Refund, refund);
    });
  }

  private async lockOriginalTransaction(
    manager: EntityManager,
    input: RefundCreationInput,
  ): Promise<Transaction> {
    const where =
      input.merchantId === null
        ? { uuid: input.transactionUuid }
        : { uuid: input.transactionUuid, merchantId: input.merchantId };
    const transaction = await manager.findOne(Transaction, {
      where,
      lock: { mode: 'pessimistic_write' },
    });

    if (transaction === null) {
      throw new AppException(
        ErrorCode.TransactionNotFound,
        'Transaction was not found.',
        404,
      );
    }

    return transaction;
  }

  private async assertCanRefund(
    manager: EntityManager,
    original: Transaction,
    amount: number,
  ): Promise<void> {
    try {
      if (original.type === TransactionType.Refund) {
        throw new Error('Refund transactions cannot be refunded.');
      }
      assertRefundableTransaction(original.status);
      const existingRefunds = await manager.find(Refund, {
        where: {
          transactionId: original.id,
          status: In([
            RefundStatus.Pending,
            RefundStatus.Processing,
            RefundStatus.Successful,
          ]),
        },
      });
      const existingRefundAmount = existingRefunds
        .filter((refund) => isRefundAmountReserved(refund.status))
        .reduce((total, refund) => total + Number(refund.amount), 0);
      assertRefundAmountAllowed({
        originalAmount: Number(original.amount),
        existingRefundAmount,
        refundAmount: amount,
      });
    } catch (error) {
      throw new AppException(
        ErrorCode.RefundAmountExceeded,
        error instanceof Error ? error.message : 'Refund amount is invalid.',
        400,
      );
    }
  }

  private createRefundTransaction(
    original: Transaction,
    dto: CreateRefundDto,
  ): Transaction {
    const transaction = this.transactionsService.createEntity({
      userId: original.userId,
      merchantId: original.merchantId,
      walletId:
        dto.destinationType === RefundDestinationType.Wallet
          ? original.walletId
          : null,
      parentTransactionId: original.id,
      type: TransactionType.Refund,
      direction:
        dto.destinationType === RefundDestinationType.Wallet
          ? TransactionDirection.Credit
          : TransactionDirection.Neutral,
      amount: dto.amount,
      currency: original.currency,
      description: dto.reason ?? `Refund for ${original.reference}`,
      externalReference: original.reference,
      metadata: {
        originalTransactionReference: original.reference,
        refundDestinationType: dto.destinationType,
      },
    });
    return transaction;
  }

  private async updateOriginalRefundStatus(
    manager: EntityManager,
    original: Transaction,
    successfulRefundAmount: number,
  ): Promise<void> {
    const successfulRefunds = await manager.find(Refund, {
      where: { transactionId: original.id, status: RefundStatus.Successful },
    });
    const totalRefunded = successfulRefunds.reduce(
      (total, refund) => total + Number(refund.amount),
      successfulRefundAmount,
    );
    const nextStatus =
      totalRefunded >= Number(original.amount)
        ? TransactionStatus.Refunded
        : TransactionStatus.PartiallyRefunded;

    if (original.status !== nextStatus) {
      this.transactionsService.transition(original, nextStatus);
      await manager.save(Transaction, original);
    }
  }

  private async lockRefund(
    manager: EntityManager,
    id: number,
  ): Promise<Refund> {
    const refund = await manager.findOne(Refund, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (refund === null) {
      throw new AppException(ErrorCode.NotFound, 'Refund was not found.', 404);
    }
    return refund;
  }

  private async queueMerchantRefundWebhook(
    refund: Refund,
    eventType: string,
  ): Promise<void> {
    if (refund.merchantId === null) {
      return;
    }
    const settings = await this.merchantsService.getSettings(refund.merchantId);
    await this.merchantWebhookService.createDelivery({
      merchantId: refund.merchantId,
      settings,
      eventType,
      data: {
        reference: refund.reference,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: refund.status,
        destinationType: refund.destinationType,
      },
    });
  }

  private toResponse(refund: Refund): RefundResponse {
    return {
      uuid: refund.uuid,
      reference: refund.reference,
      transactionId: refund.transactionId,
      transactionMerchantId: refund.merchantId,
      amount: Number(refund.amount),
      currency: refund.currency,
      destinationType: refund.destinationType,
      destinationReference: refund.destinationReference,
      reason: refund.reason,
      status: refund.status,
      failureReason: refund.failureReason,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
    };
  }

  private generateReference(): string {
    return `rfd_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  }
}
