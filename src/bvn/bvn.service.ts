import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from '../common/crypto/encryption.service';
import { PaymentProviderFactory } from '../payment-providers/payment-provider.factory';
import { UsersService } from '../users/users.service';
import { VerifyBvnDto } from './dto/verify-bvn.dto';
import {
  BvnProfile,
  BvnVerificationStatus,
} from './entities/bvn-profile.entity';
import { determineBvnStatus, maskBvn } from './bvn.util';

export interface BvnStatusResponse {
  maskedBvn: string | null;
  provider: string | null;
  verificationStatus: BvnVerificationStatus | null;
  verifiedAt: Date | null;
  failureReason: string | null;
}

@Injectable()
export class BvnService {
  constructor(
    @InjectRepository(BvnProfile)
    private readonly bvnRepository: Repository<BvnProfile>,
    private readonly encryptionService: EncryptionService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly usersService: UsersService,
  ) {}

  async verify(
    userUuid: string,
    dto: VerifyBvnDto,
  ): Promise<BvnStatusResponse> {
    const user = await this.usersService.getByUuid(userUuid);
    const provider = this.providerFactory.getProvider();
    const providerResult = await provider.verifyBvn({
      bvn: dto.bvn,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      phoneNumber: user.phoneNumber,
    });

    const status = this.determineStatus(dto, providerResult);
    const existing = await this.bvnRepository.findOne({
      where: { userId: user.id },
    });
    const profile = existing ?? this.bvnRepository.create({ userId: user.id });

    profile.encryptedBvn = this.encryptionService.encrypt(dto.bvn);
    profile.maskedBvn = maskBvn(dto.bvn);
    profile.provider = providerResult.provider;
    profile.providerCustomerId = providerResult.providerCustomerId ?? null;
    profile.verificationReference = providerResult.verificationReference;
    profile.verificationStatus = status;
    profile.verifiedFirstName = providerResult.verifiedFirstName ?? null;
    profile.verifiedLastName = providerResult.verifiedLastName ?? null;
    profile.verifiedDateOfBirth = providerResult.verifiedDateOfBirth ?? null;
    profile.verifiedPhoneNumber = providerResult.verifiedPhoneNumber ?? null;
    profile.verifiedAt =
      status === BvnVerificationStatus.Verified ? new Date() : null;
    profile.failureReason =
      status === BvnVerificationStatus.Verified
        ? null
        : (providerResult.failureReason ??
          'BVN identity details could not be verified.');
    profile.metadata = providerResult.metadata;

    return this.toStatusResponse(await this.bvnRepository.save(profile));
  }

  async getStatus(userUuid: string): Promise<BvnStatusResponse> {
    const user = await this.usersService.getByUuid(userUuid);
    const profile = await this.bvnRepository.findOne({
      where: { userId: user.id },
    });

    if (profile === null) {
      return {
        maskedBvn: null,
        provider: null,
        verificationStatus: null,
        verifiedAt: null,
        failureReason: null,
      };
    }

    return this.toStatusResponse(profile);
  }

  retry(userUuid: string, dto: VerifyBvnDto): Promise<BvnStatusResponse> {
    return this.verify(userUuid, dto);
  }

  async assertUserVerified(userUuid: string): Promise<void> {
    const status = await this.getStatus(userUuid);

    if (status.verificationStatus !== BvnVerificationStatus.Verified) {
      throw new AppException(
        ErrorCode.BvnVerificationRequired,
        'BVN verification is required for this operation.',
        403,
      );
    }
  }

  private determineStatus(
    input: VerifyBvnDto,
    result: Parameters<typeof determineBvnStatus>[1],
  ): BvnVerificationStatus {
    const status = determineBvnStatus(input, result);

    switch (status) {
      case 'pending':
        return BvnVerificationStatus.Pending;
      case 'verified':
        return BvnVerificationStatus.Verified;
      case 'failed':
        return BvnVerificationStatus.Failed;
      case 'rejected':
        return BvnVerificationStatus.Rejected;
    }
  }

  private toStatusResponse(profile: BvnProfile): BvnStatusResponse {
    return {
      maskedBvn: profile.maskedBvn,
      provider: profile.provider,
      verificationStatus: profile.verificationStatus,
      verifiedAt: profile.verifiedAt,
      failureReason: profile.failureReason,
    };
  }
}
