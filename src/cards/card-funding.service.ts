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
import { CardsService } from './cards.service';
import { FundWalletWithCardDto } from './dto/card-funding.dto';

export interface CardFundingResponse {
  reference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  walletUuid: string;
  cardUuid: string;
}

@Injectable()
export class CardFundingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cardsService: CardsService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly settingsService: SettingsService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  async fundWalletWithCard(
    userId: number,
    walletUuid: string,
    dto: FundWalletWithCardDto,
  ): Promise<CardFundingResponse> {
    const [card, wallet, paymentSettings] = await Promise.all([
      this.cardsService.getForUser(userId, dto.cardUuid),
      this.walletsService.getForUser(userId, walletUuid),
      this.settingsService.getPaymentSettings(userId),
    ]);

    this.cardsService.assertChargeableCard(card);

    if (!paymentSettings.allowCardPayments) {
      throw new AppException(
        ErrorCode.CardChargeFailed,
        'Card payments are disabled for this user.',
        403,
      );
    }

    if (wallet.currency !== dto.currency.toUpperCase()) {
      throw new AppException(
        ErrorCode.CardChargeFailed,
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
    const providerResult = await provider.chargeCard({
      amount: dto.amount,
      currency: dto.currency.toUpperCase(),
      providerCardToken: card.providerCardToken,
      reference: `card_funding_${card.uuid}`,
    });

    if (providerResult.status !== 'successful') {
      throw new AppException(
        ErrorCode.CardChargeFailed,
        providerResult.failureReason ?? 'Card charge was not successful.',
        400,
      );
    }

    const response = await this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsService.lockWalletForUser(
        manager,
        userId,
        wallet.id,
      );
      const balance = this.walletsService.creditLockedWallet(
        lockedWallet,
        dto.amount,
      );

      const transaction = this.transactionsService.createEntity({
        userId,
        walletId: lockedWallet.id,
        type: TransactionType.CardWalletFunding,
        direction: TransactionDirection.Credit,
        amount: dto.amount,
        currency: dto.currency,
        description: 'Wallet funding with saved card',
        metadata: {
          cardUuid: card.uuid,
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
        entryType: WalletLedgerEntryType.CardFunding,
        amount: dto.amount,
        balanceBefore: balance.before,
        balanceAfter: balance.after,
        metadata: {
          cardUuid: card.uuid,
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
        cardUuid: card.uuid,
      };
    });

    await this.cardsService.markCharged(card);
    return response;
  }
}
