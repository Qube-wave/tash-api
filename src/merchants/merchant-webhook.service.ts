import { createHmac, randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  MERCHANT_WEBHOOK_QUEUE,
  MerchantWebhookDeliveryJobData,
} from '../jobs/job-names';
import { MerchantSettings } from './entities/merchant-settings.entity';
import {
  MerchantWebhookDelivery,
  MerchantWebhookDeliveryStatus,
} from './entities/merchant-webhook-delivery.entity';

export interface MerchantWebhookPayload {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

@Injectable()
export class MerchantWebhookService {
  constructor(
    @InjectRepository(MerchantWebhookDelivery)
    private readonly deliveriesRepository: Repository<MerchantWebhookDelivery>,
    @Optional()
    @InjectQueue(MERCHANT_WEBHOOK_QUEUE)
    private readonly deliveryQueue?: Queue<MerchantWebhookDeliveryJobData>,
  ) {}

  signPayload(
    secret: string,
    timestamp: string,
    payload: MerchantWebhookPayload | Record<string, unknown>,
  ): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex');
  }

  async createDelivery(input: {
    merchantId: number;
    settings: MerchantSettings;
    eventType: string;
    data: Record<string, unknown>;
    plaintextSecret?: string;
  }): Promise<MerchantWebhookDelivery | null> {
    if (input.settings.webhookUrl === null) {
      return null;
    }

    const payload: MerchantWebhookPayload = {
      id: `evt_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      type: input.eventType,
      createdAt: new Date().toISOString(),
      data: input.data,
    };
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature =
      input.plaintextSecret === undefined
        ? 'pending'
        : this.signPayload(input.plaintextSecret, timestamp, payload);

    const delivery = await this.deliveriesRepository.save(
      this.deliveriesRepository.create({
        merchantId: input.merchantId,
        eventId: payload.id,
        eventType: input.eventType,
        url: input.settings.webhookUrl,
        payload: payload as unknown as Record<string, unknown>,
        signature,
        status: MerchantWebhookDeliveryStatus.Pending,
        responseStatus: null,
        responseBody: null,
        attemptCount: 0,
        nextRetryAt: null,
        deliveredAt: null,
      }),
    );

    await this.enqueueDelivery(delivery.id);
    return delivery;
  }

  async enqueueDelivery(deliveryId: number): Promise<void> {
    if (this.deliveryQueue === undefined) {
      return;
    }

    await this.deliveryQueue.add(
      'deliver-merchant-webhook',
      { deliveryId },
      {
        jobId: `merchant-webhook-delivery-${deliveryId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
