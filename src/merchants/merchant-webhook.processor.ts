import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EncryptionService } from '../common/crypto/encryption.service';
import {
  MERCHANT_WEBHOOK_QUEUE,
  MerchantWebhookDeliveryJobData,
} from '../jobs/job-names';
import { MerchantSettings } from './entities/merchant-settings.entity';
import {
  MerchantWebhookDelivery,
  MerchantWebhookDeliveryStatus,
} from './entities/merchant-webhook-delivery.entity';
import { MerchantWebhookService } from './merchant-webhook.service';

@Processor(MERCHANT_WEBHOOK_QUEUE)
export class MerchantWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchantWebhookProcessor.name);

  constructor(
    @InjectRepository(MerchantWebhookDelivery)
    private readonly deliveriesRepository: Repository<MerchantWebhookDelivery>,
    @InjectRepository(MerchantSettings)
    private readonly settingsRepository: Repository<MerchantSettings>,
    private readonly encryptionService: EncryptionService,
    private readonly merchantWebhookService: MerchantWebhookService,
  ) {
    super();
  }

  async process(job: Job<MerchantWebhookDeliveryJobData>): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: job.data.deliveryId },
    });

    if (
      delivery === null ||
      delivery.status === MerchantWebhookDeliveryStatus.Delivered
    ) {
      return;
    }

    const settings = await this.settingsRepository.findOne({
      where: { merchantId: delivery.merchantId },
    });

    if (
      settings?.webhookSecretCiphertext === undefined ||
      settings.webhookSecretCiphertext === null
    ) {
      await this.markFailed(
        delivery,
        job,
        'Merchant webhook signing secret is not configured.',
      );
      return;
    }

    const payload = delivery.payload;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secret = this.encryptionService.decrypt(
      settings.webhookSecretCiphertext,
    );
    const signature = this.merchantWebhookService.signPayload(
      secret,
      timestamp,
      payload,
    );

    try {
      const response = await this.postWebhook(delivery.url, payload, {
        'Content-Type': 'application/json',
        'X-Tash-Event-Id': delivery.eventId,
        'X-Tash-Signature': signature,
        'X-Tash-Timestamp': timestamp,
      });

      delivery.signature = signature;
      delivery.responseStatus = response.status;
      delivery.responseBody = response.body;
      delivery.attemptCount = job.attemptsMade + 1;

      if (response.status >= 200 && response.status < 300) {
        delivery.status = MerchantWebhookDeliveryStatus.Delivered;
        delivery.deliveredAt = new Date();
        delivery.nextRetryAt = null;
        await this.deliveriesRepository.save(delivery);
        return;
      }

      await this.markFailed(
        delivery,
        job,
        `Merchant webhook returned HTTP ${response.status}.`,
        signature,
      );
    } catch (error) {
      await this.markFailed(
        delivery,
        job,
        error instanceof Error
          ? error.message
          : 'Merchant webhook delivery failed.',
        signature,
      );
    }
  }

  private async postWebhook(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      return {
        status: response.status,
        body: (await response.text()).slice(0, 4000),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async markFailed(
    delivery: MerchantWebhookDelivery,
    job: Job<MerchantWebhookDeliveryJobData>,
    reason: string,
    signature?: string,
  ): Promise<void> {
    const attemptCount = job.attemptsMade + 1;
    delivery.signature = signature ?? delivery.signature;
    delivery.attemptCount = attemptCount;
    delivery.responseBody = reason.slice(0, 4000);

    if (attemptCount >= (job.opts.attempts ?? 1)) {
      delivery.status = MerchantWebhookDeliveryStatus.Failed;
      delivery.nextRetryAt = null;
      await this.deliveriesRepository.save(delivery);
      this.logger.warn(
        `Merchant webhook delivery ${delivery.id} failed: ${reason}`,
      );
      return;
    }

    delivery.status = MerchantWebhookDeliveryStatus.Pending;
    delivery.nextRetryAt = new Date(
      Date.now() + 60_000 * 2 ** Math.max(0, attemptCount - 1),
    );
    await this.deliveriesRepository.save(delivery);
    throw new Error(reason);
  }
}
