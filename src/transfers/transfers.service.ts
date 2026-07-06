import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BanksService } from '../banks/banks.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { SettingsService } from '../settings/settings.service';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import {
  LedgerDirection,
  WalletLedgerEntry,
  WalletLedgerEntryType,
} from '../wallets/entities/wallet-ledger-entry.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import { assertBankTransferAccountNameMatches } from './bank-transfer-policy';
import { CreateBankTransferDto } from './dto/create-bank-transfer.dto';
import { CreateTashTransferDto } from './dto/create-tash-transfer.dto';
import {
  assertNotSelfTransfer,
  assertTransferCurrencyMatchesWallet,
} from './transfer-policy';

export interface TashTransferResponse {
  reference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  senderWalletUuid: string;
  recipientWalletUuid: string;
  recipient: {
    uuid: string;
    paymentTag: string;
    firstName: string;
    lastName: string;
  };
}

export interface BankTransferResponse {
  reference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  walletUuid: string;
  bankCode: string;
  accountNumberLastFour: string;
  accountName: string;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly settingsService: SettingsService,
    private readonly banksService: BanksService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  async createTashTransfer(
    senderUserId: number,
    dto: CreateTashTransferDto,
  ): Promise<TashTransferResponse> {
    const senderWallet = await this.walletsService.getForUser(
      senderUserId,
      dto.walletUuid,
    );
    assertTransferCurrencyMatchesWallet(dto.currency, senderWallet.currency);

    const recipient = await this.usersService.resolveRecipient(dto.recipient);
    const recipientUser = await this.usersService.getByUuid(recipient.uuid);

    try {
      assertNotSelfTransfer(senderUserId, recipientUser.id);
    } catch (error) {
      throw new AppException(
        ErrorCode.SelfTransferNotAllowed,
        error instanceof Error
          ? error.message
          : 'Self transfer is not allowed.',
        400,
      );
    }

    await this.settingsService.validateTransactionPin(
      senderUserId,
      dto.transactionPin,
    );

    return this.dataSource.transaction(async (manager) => {
      const lockedSenderWallet = await this.walletsService.lockWalletForUser(
        manager,
        senderUserId,
        senderWallet.id,
      );
      const lockedRecipientWallet =
        await this.walletsService.lockUserWalletByCurrency(
          manager,
          recipientUser.id,
          dto.currency,
        );

      const senderBalance = this.walletsService.debitLockedWallet(
        lockedSenderWallet,
        dto.amount,
      );
      const recipientBalance = this.walletsService.creditLockedWallet(
        lockedRecipientWallet,
        dto.amount,
      );

      const transaction = this.transactionsService.createEntity({
        userId: senderUserId,
        walletId: lockedSenderWallet.id,
        type: TransactionType.WalletTransfer,
        direction: TransactionDirection.Debit,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description ?? null,
        metadata: {
          recipientUserUuid: recipient.uuid,
          recipientPaymentTag: recipient.paymentTag,
          transferKind: 'tash_to_tash',
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
      const savedTransaction = await manager.save(transaction);

      await manager.save(Wallet, [lockedSenderWallet, lockedRecipientWallet]);
      const ledgerEntries: WalletLedgerEntry[] = [
        this.walletsService.createLedgerEntry({
          wallet: lockedSenderWallet,
          transaction: savedTransaction,
          direction: LedgerDirection.Debit,
          entryType: WalletLedgerEntryType.TransferSent,
          amount: dto.amount,
          balanceBefore: senderBalance.before,
          balanceAfter: senderBalance.after,
          metadata: { recipientUserUuid: recipient.uuid },
        }),
        this.walletsService.createLedgerEntry({
          wallet: lockedRecipientWallet,
          transaction: savedTransaction,
          direction: LedgerDirection.Credit,
          entryType: WalletLedgerEntryType.TransferReceived,
          amount: dto.amount,
          balanceBefore: recipientBalance.before,
          balanceAfter: recipientBalance.after,
          metadata: { senderUserId },
        }),
      ];
      await manager.save(WalletLedgerEntry, ledgerEntries);

      return {
        reference: savedTransaction.reference,
        status: savedTransaction.status,
        amount: dto.amount,
        currency: dto.currency.toUpperCase(),
        senderWalletUuid: lockedSenderWallet.uuid,
        recipientWalletUuid: lockedRecipientWallet.uuid,
        recipient,
      };
    });
  }

  async createBankTransfer(
    userId: number,
    dto: CreateBankTransferDto,
  ): Promise<BankTransferResponse> {
    const [wallet, paymentSettings, resolvedAccount] = await Promise.all([
      this.walletsService.getForUser(userId, dto.walletUuid),
      this.settingsService.getPaymentSettings(userId),
      this.banksService.resolveAccount({
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
      }),
    ]);

    assertTransferCurrencyMatchesWallet(dto.currency, wallet.currency);

    if (!paymentSettings.allowWalletPayments) {
      throw new AppException(
        ErrorCode.WalletRestricted,
        'Wallet payments are disabled for this user.',
        403,
      );
    }

    if (dto.amount > paymentSettings.singleTransactionLimit) {
      throw new AppException(
        ErrorCode.TransactionLimitExceeded,
        'Transaction amount exceeds the single transaction limit.',
        400,
      );
    }

    try {
      assertBankTransferAccountNameMatches(
        dto.accountName,
        resolvedAccount.accountName,
      );
    } catch (error) {
      throw new AppException(
        ErrorCode.TransferFailed,
        error instanceof Error
          ? error.message
          : 'Resolved bank account name does not match request.',
        400,
      );
    }

    await this.settingsService.validateTransactionPin(
      userId,
      dto.transactionPin,
    );
    const provider = this.providerFactory.getProvider();

    return this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsService.lockWalletForUser(
        manager,
        userId,
        wallet.id,
      );
      const balance = this.walletsService.debitLockedWallet(
        lockedWallet,
        dto.amount,
      );
      const transaction = this.transactionsService.createEntity({
        userId,
        walletId: lockedWallet.id,
        type: TransactionType.WalletTransfer,
        direction: TransactionDirection.Debit,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description ?? 'Bank transfer',
        metadata: {
          transferKind: 'bank_transfer',
          bankCode: dto.bankCode,
          accountNumberLastFour: dto.accountNumber.slice(-4),
          accountName: resolvedAccount.accountName,
        },
      });
      this.transactionsService.transition(
        transaction,
        TransactionStatus.Processing,
      );
      const savedTransaction = await manager.save(transaction);

      const providerResult = await provider.sendBankTransfer({
        amount: dto.amount,
        currency: dto.currency.toUpperCase(),
        reference: savedTransaction.reference,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: resolvedAccount.accountName,
      });

      savedTransaction.provider = providerResult.provider;
      savedTransaction.providerReference = providerResult.providerReference;

      if (providerResult.status !== 'successful') {
        savedTransaction.failureReason =
          providerResult.failureReason ?? 'Bank transfer failed.';
        this.transactionsService.transition(
          savedTransaction,
          TransactionStatus.Failed,
        );
        await manager.save(savedTransaction);
        throw new AppException(
          ErrorCode.TransferFailed,
          savedTransaction.failureReason,
          400,
        );
      }

      this.transactionsService.transition(
        savedTransaction,
        TransactionStatus.Successful,
      );
      await manager.save(savedTransaction);
      await manager.save(Wallet, lockedWallet);
      const ledgerEntry = this.walletsService.createLedgerEntry({
        wallet: lockedWallet,
        transaction: savedTransaction,
        direction: LedgerDirection.Debit,
        entryType: WalletLedgerEntryType.TransferSent,
        amount: dto.amount,
        balanceBefore: balance.before,
        balanceAfter: balance.after,
        metadata: {
          transferKind: 'bank_transfer',
          bankCode: dto.bankCode,
          accountNumberLastFour: dto.accountNumber.slice(-4),
          accountName: resolvedAccount.accountName,
          providerReference: providerResult.providerReference,
        },
      });
      await manager.save(WalletLedgerEntry, ledgerEntry);

      return {
        reference: savedTransaction.reference,
        status: savedTransaction.status,
        amount: dto.amount,
        currency: dto.currency.toUpperCase(),
        walletUuid: lockedWallet.uuid,
        bankCode: dto.bankCode,
        accountNumberLastFour: dto.accountNumber.slice(-4),
        accountName: resolvedAccount.accountName,
      };
    });
  }
}
