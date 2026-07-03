import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from './entities/idempotency-record.entity';
import { hashIdempotencyRequest } from './idempotency.util';

export interface IdempotencyStartResult {
  record: IdempotencyRecord;
  replayResponse: Record<string, unknown> | null;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly recordsRepository: Repository<IdempotencyRecord>,
  ) {}

  async startConsumerRequest(input: {
    userId: number;
    route: string;
    idempotencyKey: string | undefined;
    requestBody: unknown;
  }): Promise<IdempotencyStartResult> {
    if (
      input.idempotencyKey === undefined ||
      input.idempotencyKey.trim() === ''
    ) {
      throw new AppException(
        ErrorCode.IdempotencyConflict,
        'Idempotency-Key header is required for this request.',
        400,
      );
    }

    const idempotencyKey = input.idempotencyKey.trim();
    const requestHash = hashIdempotencyRequest(input.requestBody);
    const existing = await this.recordsRepository.findOne({
      where: {
        userId: input.userId,
        route: input.route,
        idempotencyKey,
      },
    });

    if (existing !== null) {
      if (existing.requestHash !== requestHash) {
        throw new AppException(
          ErrorCode.IdempotencyConflict,
          'Idempotency key was already used for a different request.',
          409,
        );
      }

      return {
        record: existing,
        replayResponse:
          existing.status === IdempotencyRecordStatus.Completed
            ? existing.responseBody
            : null,
      };
    }

    const record = await this.recordsRepository.save(
      this.recordsRepository.create({
        userId: input.userId,
        merchantId: null,
        route: input.route,
        idempotencyKey,
        requestHash,
        responseStatus: null,
        responseBody: null,
        status: IdempotencyRecordStatus.Processing,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    return { record, replayResponse: null };
  }

  async startMerchantRequest(input: {
    merchantId: number;
    route: string;
    idempotencyKey: string | undefined;
    requestBody: unknown;
  }): Promise<IdempotencyStartResult> {
    if (
      input.idempotencyKey === undefined ||
      input.idempotencyKey.trim() === ''
    ) {
      throw new AppException(
        ErrorCode.IdempotencyConflict,
        'Idempotency-Key header is required for this request.',
        400,
      );
    }

    const idempotencyKey = input.idempotencyKey.trim();
    const requestHash = hashIdempotencyRequest(input.requestBody);
    const existing = await this.recordsRepository.findOne({
      where: {
        merchantId: input.merchantId,
        route: input.route,
        idempotencyKey,
      },
    });

    if (existing !== null) {
      if (existing.requestHash !== requestHash) {
        throw new AppException(
          ErrorCode.IdempotencyConflict,
          'Idempotency key was already used for a different request.',
          409,
        );
      }

      return {
        record: existing,
        replayResponse:
          existing.status === IdempotencyRecordStatus.Completed
            ? existing.responseBody
            : null,
      };
    }

    const record = await this.recordsRepository.save(
      this.recordsRepository.create({
        userId: null,
        merchantId: input.merchantId,
        route: input.route,
        idempotencyKey,
        requestHash,
        responseStatus: null,
        responseBody: null,
        status: IdempotencyRecordStatus.Processing,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    return { record, replayResponse: null };
  }

  async complete(
    record: IdempotencyRecord,
    responseBody: Record<string, unknown>,
    responseStatus = 200,
  ): Promise<void> {
    record.status = IdempotencyRecordStatus.Completed;
    record.responseStatus = responseStatus;
    record.responseBody = responseBody;
    await this.recordsRepository.save(record);
  }

  async fail(record: IdempotencyRecord): Promise<void> {
    record.status = IdempotencyRecordStatus.Failed;
    await this.recordsRepository.save(record);
  }
}
