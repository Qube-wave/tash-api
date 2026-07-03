import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvnService } from '../bvn/bvn.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { WalletsService } from '../wallets/wallets.service';
import { CreateVirtualAccountDto } from './dto/virtual-account.dto';
import {
  VirtualAccount,
  VirtualAccountPurpose,
  VirtualAccountStatus,
  VirtualAccountType,
} from './entities/virtual-account.entity';
import { assertVirtualAccountCanReceiveFunding } from './virtual-account-policy';

export interface VirtualAccountResponse {
  uuid: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string | null;
  currency: string;
  type: VirtualAccountType;
  purpose: VirtualAccountPurpose;
  status: VirtualAccountStatus;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class VirtualAccountsService {
  constructor(
    @InjectRepository(VirtualAccount)
    private readonly virtualAccountsRepository: Repository<VirtualAccount>,
    private readonly bvnService: BvnService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly walletsService: WalletsService,
  ) {}

  async create(
    userUuid: string,
    userId: number,
    dto: CreateVirtualAccountDto,
  ): Promise<VirtualAccountResponse> {
    await this.bvnService.assertUserVerified(userUuid);
    const wallet = await this.walletsService.getForUser(userId, dto.walletUuid);
    const provider = this.providerFactory.getProvider();
    const providerAccount = await provider.createVirtualAccount({
      userUuid,
      walletUuid: wallet.uuid,
      currency: wallet.currency,
      type: dto.type,
      purpose: dto.purpose,
    });

    const account = await this.virtualAccountsRepository.save(
      this.virtualAccountsRepository.create({
        userId,
        walletId: wallet.id,
        provider: providerAccount.provider,
        providerCustomerId: providerAccount.providerCustomerId ?? null,
        providerAccountId: providerAccount.providerAccountId,
        accountName: providerAccount.accountName,
        accountNumber: providerAccount.accountNumber,
        bankName: providerAccount.bankName,
        bankCode: providerAccount.bankCode ?? null,
        currency: wallet.currency,
        type: dto.type,
        purpose: dto.purpose,
        status: VirtualAccountStatus.Active,
        expiresAt:
          dto.type === VirtualAccountType.Temporary
            ? new Date(Date.now() + 60 * 60 * 1000)
            : null,
        metadata: providerAccount.metadata,
      }),
    );

    return this.toResponse(account);
  }

  async listForUser(userId: number): Promise<VirtualAccountResponse[]> {
    const accounts = await this.virtualAccountsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return accounts.map((account) => this.toResponse(account));
  }

  async getForUser(userId: number, uuid: string): Promise<VirtualAccount> {
    const account = await this.virtualAccountsRepository.findOne({
      where: { userId, uuid },
    });
    if (account === null) {
      throw new AppException(
        ErrorCode.VirtualAccountNotFound,
        'Virtual account was not found.',
        404,
      );
    }

    return account;
  }

  async getResponseForUser(
    userId: number,
    uuid: string,
  ): Promise<VirtualAccountResponse> {
    return this.toResponse(await this.getForUser(userId, uuid));
  }

  async disable(userId: number, uuid: string): Promise<VirtualAccountResponse> {
    const account = await this.getForUser(userId, uuid);
    account.status = VirtualAccountStatus.Disabled;
    return this.toResponse(await this.virtualAccountsRepository.save(account));
  }

  async findFundingAccountByProviderReference(input: {
    provider: string;
    providerAccountId?: string;
    accountNumber?: string;
  }): Promise<VirtualAccount> {
    if (
      input.providerAccountId === undefined &&
      input.accountNumber === undefined
    ) {
      throw new AppException(
        ErrorCode.VirtualAccountNotFound,
        'Virtual account provider reference is required.',
        400,
      );
    }

    const account = await this.virtualAccountsRepository.findOne({
      where: [
        ...(input.providerAccountId === undefined
          ? []
          : [
              {
                provider: input.provider,
                providerAccountId: input.providerAccountId,
              },
            ]),
        ...(input.accountNumber === undefined
          ? []
          : [{ provider: input.provider, accountNumber: input.accountNumber }]),
      ],
    });

    if (account === null) {
      throw new AppException(
        ErrorCode.VirtualAccountNotFound,
        'Virtual account was not found.',
        404,
      );
    }

    try {
      assertVirtualAccountCanReceiveFunding(
        account.status,
        account.purpose,
        account.expiresAt,
        new Date(),
      );
    } catch (error) {
      throw new AppException(
        ErrorCode.VirtualAccountNotFound,
        error instanceof Error
          ? error.message
          : 'Virtual account cannot receive funding.',
        400,
      );
    }

    return account;
  }

  toResponse(account: VirtualAccount): VirtualAccountResponse {
    return {
      uuid: account.uuid,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      bankCode: account.bankCode,
      currency: account.currency,
      type: account.type,
      purpose: account.purpose,
      status: account.status,
      expiresAt: account.expiresAt,
      createdAt: account.createdAt,
    };
  }
}
