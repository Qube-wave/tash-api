import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { ListTransactionsQuery } from './dto/list-transactions.query';
import {
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { assertTransactionTransition } from './transaction-state-machine';

export interface CreateTransactionInput {
  userId: number;
  walletId?: number | null;
  merchantId?: number | null;
  cardId?: number | null;
  directDebitMandateId?: number | null;
  virtualAccountId?: number | null;
  payWithTashSessionId?: number | null;
  parentTransactionId?: number | null;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  fee?: number;
  currency: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  externalReference?: string | null;
}

export interface TransactionResponse {
  uuid: string;
  reference: string;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: TransactionStatus;
  description: string | null;
  metadata: Record<string, unknown>;
  initiatedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  createEntity(input: CreateTransactionInput): Transaction {
    const fee = input.fee ?? 0;
    return this.transactionsRepository.create({
      reference: this.generateReference(),
      userId: input.userId,
      walletId: input.walletId ?? null,
      merchantId: input.merchantId ?? null,
      cardId: input.cardId ?? null,
      directDebitMandateId: input.directDebitMandateId ?? null,
      virtualAccountId: input.virtualAccountId ?? null,
      payWithTashSessionId: input.payWithTashSessionId ?? null,
      parentTransactionId: input.parentTransactionId ?? null,
      provider: null,
      providerReference: null,
      externalReference: input.externalReference ?? null,
      type: input.type,
      direction: input.direction,
      amount: String(input.amount),
      fee: String(fee),
      netAmount: String(input.amount - fee),
      currency: input.currency.toUpperCase(),
      status: TransactionStatus.Created,
      failureCode: null,
      failureReason: null,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      initiatedAt: new Date(),
      completedAt: null,
    });
  }

  async save(transaction: Transaction): Promise<Transaction> {
    return this.transactionsRepository.save(transaction);
  }

  transition(
    transaction: Transaction,
    nextStatus: TransactionStatus,
  ): Transaction {
    try {
      assertTransactionTransition(transaction.status, nextStatus);
    } catch (error) {
      throw new AppException(
        ErrorCode.InvalidTransactionState,
        error instanceof Error
          ? error.message
          : 'Invalid transaction state transition.',
        400,
      );
    }

    transaction.status = nextStatus;
    if (
      nextStatus === TransactionStatus.Successful ||
      nextStatus === TransactionStatus.Failed ||
      nextStatus === TransactionStatus.Cancelled ||
      nextStatus === TransactionStatus.Reversed
    ) {
      transaction.completedAt = new Date();
    }

    return transaction;
  }

  async listForUser(
    userId: number,
    query: ListTransactionsQuery,
  ): Promise<{ items: TransactionResponse[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;
    const cursor = this.parseCursor(query.cursor);
    this.assertAmountRange(query.minimumAmount, query.maximumAmount);

    const builder = this.transactionsRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId });

    if (query.type !== undefined) {
      builder.andWhere('transaction.type = :type', { type: query.type });
    }

    if (query.status !== undefined) {
      builder.andWhere('transaction.status = :status', {
        status: query.status,
      });
    }

    if (query.direction !== undefined) {
      builder.andWhere('transaction.direction = :direction', {
        direction: query.direction,
      });
    }

    if (query.currency !== undefined) {
      builder.andWhere('transaction.currency = :currency', {
        currency: query.currency.toUpperCase(),
      });
    }

    if (cursor !== undefined) {
      builder.andWhere('transaction.id < :cursor', { cursor });
    }

    if (query.dateFrom !== undefined) {
      builder.andWhere('transaction.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo !== undefined) {
      builder.andWhere('transaction.createdAt <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    if (query.minimumAmount !== undefined) {
      builder.andWhere('transaction.amount >= :minimumAmount', {
        minimumAmount: String(query.minimumAmount),
      });
    }

    if (query.maximumAmount !== undefined) {
      builder.andWhere('transaction.amount <= :maximumAmount', {
        maximumAmount: String(query.maximumAmount),
      });
    }

    const transactions = await builder
      .orderBy('transaction.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const visible = transactions.slice(0, limit);
    const next = transactions.length > limit ? transactions[limit] : undefined;

    return {
      items: visible.map((transaction) => this.toResponse(transaction)),
      nextCursor: next === undefined ? null : String(next.id),
    };
  }

  async listForMerchant(merchantId: number): Promise<TransactionResponse[]> {
    const transactions = await this.transactionsRepository.find({
      where: { merchantId },
      order: { id: 'DESC' },
      take: 50,
    });

    return transactions.map((transaction) => this.toResponse(transaction));
  }

  async getEntityByReference(reference: string): Promise<Transaction> {
    const transaction = await this.findEntityByReference(reference);

    if (transaction === null) {
      throw new AppException(
        ErrorCode.TransactionNotFound,
        'Transaction was not found.',
        404,
      );
    }

    return transaction;
  }

  async findEntityByReference(reference: string): Promise<Transaction | null> {
    return this.transactionsRepository.findOne({
      where: { reference },
    });
  }

  async findByProviderReference(
    provider: string,
    providerReference: string,
  ): Promise<Transaction | null> {
    return this.transactionsRepository.findOne({
      where: { provider, providerReference },
    });
  }

  async getForUser(userId: number, uuid: string): Promise<TransactionResponse> {
    const transaction = await this.transactionsRepository.findOne({
      where: { userId, uuid },
    });

    if (transaction === null) {
      throw new NotFoundException('Transaction was not found.');
    }

    return this.toResponse(transaction);
  }

  async getByReferenceForUser(
    userId: number,
    reference: string,
  ): Promise<TransactionResponse> {
    return this.toResponse(
      await this.getEntityByReferenceForUser(userId, reference),
    );
  }

  async getEntityByReferenceForUser(
    userId: number,
    reference: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { userId, reference },
    });

    if (transaction === null) {
      throw new NotFoundException('Transaction was not found.');
    }

    return transaction;
  }

  private parseCursor(cursor: string | undefined): number | undefined {
    if (cursor === undefined) {
      return undefined;
    }

    const parsed = Number(cursor);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException('Invalid transaction cursor.');
    }

    return parsed;
  }

  private assertAmountRange(
    minimumAmount: number | undefined,
    maximumAmount: number | undefined,
  ): void {
    if (
      minimumAmount !== undefined &&
      maximumAmount !== undefined &&
      minimumAmount > maximumAmount
    ) {
      throw new BadRequestException(
        'minimumAmount cannot be greater than maximumAmount.',
      );
    }
  }

  toResponse(transaction: Transaction): TransactionResponse {
    return {
      uuid: transaction.uuid,
      reference: transaction.reference,
      type: transaction.type,
      direction: transaction.direction,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      netAmount: Number(transaction.netAmount),
      currency: transaction.currency,
      status: transaction.status,
      description: transaction.description,
      metadata: transaction.metadata,
      initiatedAt: transaction.initiatedAt,
      completedAt: transaction.completedAt,
      createdAt: transaction.createdAt,
    };
  }

  private generateReference(): string {
    return `txn_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  }
}
