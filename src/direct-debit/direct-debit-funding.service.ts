import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import {
  LedgerDirection,
  WalletLedgerEntry,
  WalletLedgerEntryType,
} from '../wallets/entities/wallet-ledger-entry.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import { DirectDebitService } from './direct-debit.service';
import { FundWalletWithDirectDebitDto } from './dto/direct-debit.dto';

export interface DirectDebitFundingResponse {
  reference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  walletUuid: string;
  mandateUuid: string;
}

@Injectable()
export class DirectDebitFundingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly directDebitService: DirectDebitService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly settingsService: SettingsService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  async fundWalletWithDirectDebit(
    userId: number,
    walletUuid: string,
    dto: FundWalletWithDirectDebitDto,
  ): Promise<DirectDebitFundingResponse> {
    const [mandate, wallet, paymentSettings] = await Promise.all([
      this.directDebitService.getForUser(userId, dto.mandateUuid),
      this.walletsService.getForUser(userId, walletUuid),
      this.settingsService.getPaymentSettings(userId),
    ]);

    this.directDebitService.assertChargeableMandate(mandate, dto.amount);

    if (!paymentSettings.allowDirectDebitPayments) {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        'Direct-debit payments are disabled for this user.',
        403,
      );
    }

    if (wallet.currency !== dto.currency.toUpperCase()) {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        'Funding currency must match wallet currency.',
        400,
      );
    }

    if (dto.amount > paymentSettings.singleTransactionLimit) {
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

    const provider = this.providerFactory.getProvider();
    const providerResult = await provider.chargeDirectDebitMandate({
      providerMandateId: mandate.providerMandateId,
      amount: dto.amount,
      currency: dto.currency.toUpperCase(),
      reference: `direct_debit_funding_${mandate.uuid}`,
    });

    if (providerResult.status !== 'successful') {
      throw new AppException(
        ErrorCode.DirectDebitChargeFailed,
        providerResult.failureReason ??
          'Direct-debit charge was not successful.',
        400,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsService.lockWallet(
        manager,
        wallet.id,
      );
      const balance = this.walletsService.creditLockedWallet(
        lockedWallet,
        dto.amount,
      );

      const transaction = this.transactionsService.createEntity({
        userId,
        walletId: lockedWallet.id,
        type: TransactionType.DirectDebitWalletFunding,
        direction: TransactionDirection.Credit,
        amount: dto.amount,
        currency: dto.currency,
        description: 'Wallet funding with direct debit',
        metadata: {
          mandateUuid: mandate.uuid,
          providerReference: providerResult.providerReference,
        },
      });
      transaction.provider = providerResult.provider;
      transaction.providerReference = providerResult.providerReference;
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
        entryType: WalletLedgerEntryType.DirectDebitFunding,
        amount: dto.amount,
        balanceBefore: balance.before,
        balanceAfter: balance.after,
        metadata: {
          mandateUuid: mandate.uuid,
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
        mandateUuid: mandate.uuid,
      };
    });
  }
}
