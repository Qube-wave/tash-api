import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  WalletLedgerEntryResponse,
  WalletResponse,
} from './dto/wallet-response.dto';
import {
  LedgerDirection,
  WalletLedgerEntry,
  WalletLedgerEntryStatus,
  WalletLedgerEntryType,
} from './entities/wallet-ledger-entry.entity';
import { Wallet, WalletStatus } from './entities/wallet.entity';
import { applyCredit, applyDebit } from './wallet-balance-policy';

export interface WalletUserLockInput<T extends string = string> {
  key: T;
  userId: number;
  walletId: number;
}

export interface LedgerEntryInput {
  wallet: Wallet;
  transaction: Transaction;
  direction: LedgerDirection;
  entryType: WalletLedgerEntryType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletLedgerEntry)
    private readonly ledgerRepository: Repository<WalletLedgerEntry>,
  ) {}

  async createDefaultWallet(userId: number, currency = 'NGN'): Promise<Wallet> {
    const normalizedCurrency = currency.toUpperCase();
    const existing = await this.walletsRepository.findOne({
      where: { userId, currency: normalizedCurrency },
    });

    if (existing !== null) {
      return existing;
    }

    return this.walletsRepository.save(
      this.walletsRepository.create({
        userId,
        currency: normalizedCurrency,
        availableBalance: '0',
        pendingBalance: '0',
        ledgerBalance: '0',
        status: WalletStatus.Active,
      }),
    );
  }

  async listForUser(userId: number): Promise<WalletResponse[]> {
    const wallets = await this.walletsRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return wallets.map((wallet) => this.toResponse(wallet));
  }

  async getForUser(userId: number, uuid: string): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOne({
      where: { userId, uuid },
    });
    if (wallet === null) {
      throw new AppException(
        ErrorCode.WalletNotFound,
        'Wallet was not found.',
        404,
      );
    }

    return wallet;
  }

  async getByUserAndCurrency(
    userId: number,
    currency: string,
  ): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOne({
      where: { userId, currency: currency.toUpperCase() },
    });

    if (wallet === null) {
      throw new AppException(
        ErrorCode.WalletNotFound,
        'Wallet was not found.',
        404,
      );
    }

    return wallet;
  }

  async getResponseForUser(
    userId: number,
    uuid: string,
  ): Promise<WalletResponse> {
    return this.toResponse(await this.getForUser(userId, uuid));
  }

  async listLedgerForUser(
    userId: number,
    walletUuid: string,
  ): Promise<WalletLedgerEntryResponse[]> {
    const wallet = await this.getForUser(userId, walletUuid);
    const entries = await this.ledgerRepository.find({
      where: { walletId: wallet.id },
      order: { id: 'DESC' },
      take: 50,
    });

    return entries.map((entry) => this.toLedgerResponse(entry));
  }

  async lockWallet(manager: EntityManager, walletId: number): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (wallet === null) {
      throw new AppException(
        ErrorCode.WalletNotFound,
        'Wallet was not found.',
        404,
      );
    }

    if (wallet.status !== WalletStatus.Active) {
      throw new AppException(
        ErrorCode.WalletRestricted,
        'Wallet is not active for this operation.',
        403,
      );
    }

    return wallet;
  }

  async lockWalletForUser(
    manager: EntityManager,
    userId: number,
    walletId: number,
  ): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, {
      where: { id: walletId, userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (wallet === null) {
      throw new AppException(
        ErrorCode.WalletNotFound,
        'Wallet was not found.',
        404,
      );
    }

    if (wallet.status !== WalletStatus.Active) {
      throw new AppException(
        ErrorCode.WalletRestricted,
        'Wallet is not active for this operation.',
        403,
      );
    }

    return wallet;
  }

  async lockWalletsForUsers<T extends string>(
    manager: EntityManager,
    locks: WalletUserLockInput<T>[],
  ): Promise<Record<T, Wallet>> {
    const lockedWallets = {} as Record<T, Wallet>;
    const orderedLocks = [...locks].sort(
      (left, right) =>
        left.walletId - right.walletId || left.userId - right.userId,
    );

    for (const lock of orderedLocks) {
      lockedWallets[lock.key] = await this.lockWalletForUser(
        manager,
        lock.userId,
        lock.walletId,
      );
    }

    return lockedWallets;
  }

  async lockUserWalletByCurrency(
    manager: EntityManager,
    userId: number,
    currency: string,
  ): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, {
      where: { userId, currency: currency.toUpperCase() },
      lock: { mode: 'pessimistic_write' },
    });

    if (wallet === null) {
      throw new AppException(
        ErrorCode.WalletNotFound,
        'Wallet was not found.',
        404,
      );
    }

    if (wallet.status !== WalletStatus.Active) {
      throw new AppException(
        ErrorCode.WalletRestricted,
        'Wallet is not active for this operation.',
        403,
      );
    }

    return wallet;
  }

  debitLockedWallet(
    wallet: Wallet,
    amount: number,
  ): { before: number; after: number } {
    const before = Number(wallet.availableBalance);
    let after: number;

    try {
      after = applyDebit(
        {
          availableBalance: Number(wallet.availableBalance),
          ledgerBalance: Number(wallet.ledgerBalance),
        },
        amount,
      ).availableBalance;
    } catch (error) {
      throw new AppException(
        ErrorCode.InsufficientWalletBalance,
        error instanceof Error ? error.message : 'Insufficient wallet balance.',
        400,
      );
    }

    wallet.availableBalance = String(after);
    wallet.ledgerBalance = String(after);
    return { before, after };
  }

  creditLockedWallet(
    wallet: Wallet,
    amount: number,
  ): { before: number; after: number } {
    const before = Number(wallet.availableBalance);
    const next = applyCredit(
      {
        availableBalance: Number(wallet.availableBalance),
        ledgerBalance: Number(wallet.ledgerBalance),
      },
      amount,
    );
    wallet.availableBalance = String(next.availableBalance);
    wallet.ledgerBalance = String(next.ledgerBalance);
    return { before, after: next.availableBalance };
  }

  createLedgerEntry(input: LedgerEntryInput): WalletLedgerEntry {
    return this.ledgerRepository.create({
      walletId: input.wallet.id,
      transactionId: input.transaction.id,
      reference: `wle_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      direction: input.direction,
      entryType: input.entryType,
      amount: String(input.amount),
      currency: input.wallet.currency,
      balanceBefore: String(input.balanceBefore),
      balanceAfter: String(input.balanceAfter),
      status: WalletLedgerEntryStatus.Completed,
      metadata: input.metadata ?? {},
    });
  }

  toResponse(wallet: Wallet): WalletResponse {
    return {
      walletUuid: wallet.uuid,
      currency: wallet.currency,
      availableBalance: Number(wallet.availableBalance),
      ledgerBalance: Number(wallet.ledgerBalance),
      status: wallet.status,
    };
  }

  toLedgerResponse(entry: WalletLedgerEntry): WalletLedgerEntryResponse {
    return {
      uuid: entry.uuid,
      reference: entry.reference,
      direction: entry.direction,
      entryType: entry.entryType,
      amount: Number(entry.amount),
      currency: entry.currency,
      balanceBefore: Number(entry.balanceBefore),
      balanceAfter: Number(entry.balanceAfter),
      status: entry.status,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    };
  }

  async getBalance(
    userId: number,
    walletUuid: string,
  ): Promise<WalletResponse> {
    const wallet = await this.getForUser(userId, walletUuid);
    if (wallet === null) {
      throw new NotFoundException('Wallet was not found.');
    }

    return this.toResponse(wallet);
  }
}
