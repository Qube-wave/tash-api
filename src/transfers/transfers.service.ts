import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BanksService } from '../banks/banks.service';
import { CardFundingService } from '../cards/card-funding.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { DirectDebitFundingService } from '../direct-debit/direct-debit-funding.service';
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
import { TransferFundingSource } from './dto/transfer-funding-source.enum';
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

interface TransferFundingResult {
  source: TransferFundingSource;
  transactionReference?: string;
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
    private readonly cardFundingService: CardFundingService,
    private readonly directDebitFundingService: DirectDebitFundingService,
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

    const recipientWallet = await this.walletsService.getByUserAndCurrency(
      recipientUser.id,
      dto.currency,
    );

    const funding = await this.prepareTransferFundingSource(
      senderUserId,
      dto.walletUuid,
      dto,
    );

    return this.dataSource.transaction(async (manager) => {
      const lockedWallets = await this.walletsService.lockWalletsForUsers(
        manager,
        [
          {
            key: 'sender',
            userId: senderUserId,
            walletId: senderWallet.id,
          },
          {
            key: 'recipient',
            userId: recipientUser.id,
            walletId: recipientWallet.id,
          },
        ],
      );
      const lockedSenderWallet = lockedWallets.sender;
      const lockedRecipientWallet = lockedWallets.recipient;

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
          fundingSource: funding.source,
          fundingTransactionReference: funding.transactionReference,
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
          metadata: {
            recipientUserUuid: recipient.uuid,
            fundingSource: funding.source,
            fundingTransactionReference: funding.transactionReference,
          },
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

    const funding = await this.prepareTransferFundingSource(
      userId,
      dto.walletUuid,
      dto,
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
          fundingSource: funding.source,
          fundingTransactionReference: funding.transactionReference,
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

      if (providerResult.status === 'failed') {
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

      if (providerResult.status === 'successful') {
        this.transactionsService.transition(
          savedTransaction,
          TransactionStatus.Successful,
        );
      }

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
          fundingSource: funding.source,
          fundingTransactionReference: funding.transactionReference,
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

  async requeryTransfer(
    userId: number,
    reference: string,
  ): Promise<TransactionResponse> {
    const transaction =
      await this.transactionsService.getEntityByReferenceForUser(
        userId,
        reference,
      );

    if (
      transaction.provider === null &&
      transaction.providerReference === null
    ) {
      throw new AppException(
        ErrorCode.BadRequest,
        'Only provider-backed transfers can be re-queried.',
        400,
      );
    }

    const providerTransaction = await this.providerFactory
      .getProvider()
      .verifyTransaction(
        transaction.providerReference ?? transaction.reference,
      );

    return this.finalizeProviderTransfer(transaction, providerTransaction);
  }

  private async finalizeProviderTransfer(
    transaction: Transaction,
    providerTransaction: {
      provider: string;
      providerReference: string;
      status: 'pending' | 'successful' | 'failed' | 'reversed';
      metadata: Record<string, unknown>;
    },
  ): Promise<TransactionResponse> {
    if (providerTransaction.status === 'pending') {
      transaction.provider = providerTransaction.provider;
      transaction.providerReference = providerTransaction.providerReference;
      return this.transactionsService.toResponse(
        await this.transactionsService.save(transaction),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const transactionRepository = manager.getRepository(Transaction);
      const lockedTransaction = await transactionRepository.findOne({
        where: { id: transaction.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (lockedTransaction === null) {
        throw new AppException(
          ErrorCode.TransactionNotFound,
          'Transaction was not found.',
          404,
        );
      }

      lockedTransaction.provider = providerTransaction.provider;
      lockedTransaction.providerReference =
        providerTransaction.providerReference;

      if (providerTransaction.status === 'successful') {
        if (
          lockedTransaction.status === TransactionStatus.Reversed ||
          lockedTransaction.status === TransactionStatus.Failed
        ) {
          return this.transactionsService.toResponse(lockedTransaction);
        }

        if (lockedTransaction.status !== TransactionStatus.Successful) {
          this.transactionsService.transition(
            lockedTransaction,
            TransactionStatus.Successful,
          );
        }

        return this.transactionsService.toResponse(
          await transactionRepository.save(lockedTransaction),
        );
      }

      if (
        lockedTransaction.status === TransactionStatus.Reversed ||
        lockedTransaction.status === TransactionStatus.Failed
      ) {
        return this.transactionsService.toResponse(lockedTransaction);
      }

      lockedTransaction.failureReason =
        this.readProviderFailureReason(providerTransaction.metadata) ??
        'Provider transfer was not completed.';

      const existingReversal = await transactionRepository.findOne({
        where: {
          parentTransactionId: lockedTransaction.id,
          type: TransactionType.Reversal,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingReversal === null && lockedTransaction.walletId !== null) {
        const amount = Number(lockedTransaction.amount);
        const lockedWallet = await this.walletsService.lockWallet(
          manager,
          lockedTransaction.walletId,
        );
        const balance = this.walletsService.creditLockedWallet(
          lockedWallet,
          amount,
        );
        const reversal = this.transactionsService.createEntity({
          userId: lockedTransaction.userId,
          walletId: lockedWallet.id,
          parentTransactionId: lockedTransaction.id,
          type: TransactionType.Reversal,
          direction: TransactionDirection.Credit,
          amount,
          currency: lockedTransaction.currency,
          description: 'Transfer reversal',
          externalReference: providerTransaction.providerReference,
          metadata: {
            originalTransactionReference: lockedTransaction.reference,
            providerReference: providerTransaction.providerReference,
            providerStatus: providerTransaction.status,
          },
        });
        reversal.provider = providerTransaction.provider;
        reversal.providerReference = providerTransaction.providerReference;
        this.transactionsService.transition(
          reversal,
          TransactionStatus.Processing,
        );
        this.transactionsService.transition(
          reversal,
          TransactionStatus.Successful,
        );
        const savedReversal = await manager.save(reversal);

        await manager.save(Wallet, lockedWallet);
        await manager.save(
          WalletLedgerEntry,
          this.walletsService.createLedgerEntry({
            wallet: lockedWallet,
            transaction: savedReversal,
            direction: LedgerDirection.Credit,
            entryType: WalletLedgerEntryType.Reversal,
            amount,
            balanceBefore: balance.before,
            balanceAfter: balance.after,
            metadata: {
              originalTransactionReference: lockedTransaction.reference,
              providerReference: providerTransaction.providerReference,
              providerStatus: providerTransaction.status,
            },
          }),
        );
      }

      this.transactionsService.transition(
        lockedTransaction,
        lockedTransaction.walletId === null
          ? TransactionStatus.Failed
          : TransactionStatus.Reversed,
      );

      return this.transactionsService.toResponse(
        await transactionRepository.save(lockedTransaction),
      );
    });
  }

  private readProviderFailureReason(
    metadata: Record<string, unknown>,
  ): string | undefined {
    const message = metadata.message ?? metadata.responseMessage;
    return typeof message === 'string' && message.trim() !== ''
      ? message.trim()
      : undefined;
  }

  private async prepareTransferFundingSource(
    userId: number,
    walletUuid: string,
    dto: {
      amount: number;
      currency: string;
      transactionPin: string;
      fundingSource?: TransferFundingSource;
      cardUuid?: string;
      mandateUuid?: string;
    },
  ): Promise<TransferFundingResult> {
    const source = dto.fundingSource ?? TransferFundingSource.Wallet;

    if (source === TransferFundingSource.Wallet) {
      await this.settingsService.validateTransactionPin(
        userId,
        dto.transactionPin,
      );
      return { source };
    }

    if (source === TransferFundingSource.VirtualAccount) {
      throw new AppException(
        ErrorCode.TransferFailed,
        'Virtual account funding is asynchronous. Fund the virtual account first, wait for the wallet credit, then transfer from wallet.',
        400,
      );
    }

    if (source === TransferFundingSource.Card) {
      if (dto.cardUuid === undefined) {
        throw new AppException(
          ErrorCode.BadRequest,
          'cardUuid is required when fundingSource is card.',
          400,
        );
      }

      const funding = await this.cardFundingService.fundWalletWithCard(
        userId,
        walletUuid,
        {
          cardUuid: dto.cardUuid,
          amount: dto.amount,
          currency: dto.currency,
          transactionPin: dto.transactionPin,
        },
      );

      return { source, transactionReference: funding.reference };
    }

    if (dto.mandateUuid === undefined) {
      throw new AppException(
        ErrorCode.BadRequest,
        'mandateUuid is required when fundingSource is direct_debit.',
        400,
      );
    }

    const funding =
      await this.directDebitFundingService.fundWalletWithDirectDebit(
        userId,
        walletUuid,
        {
          mandateUuid: dto.mandateUuid,
          amount: dto.amount,
          currency: dto.currency,
          transactionPin: dto.transactionPin,
        },
      );

    return { source, transactionReference: funding.reference };
  }
}
