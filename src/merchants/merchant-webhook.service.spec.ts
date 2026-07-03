import { createHmac } from 'node:crypto';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { MerchantWebhookDeliveryJobData } from '../jobs/job-names';
import { MerchantWebhookDelivery } from './entities/merchant-webhook-delivery.entity';
import { MerchantWebhookService } from './merchant-webhook.service';

describe('MerchantWebhookService', () => {
  it('signs the timestamp and JSON payload with the merchant webhook secret', () => {
    const service = new MerchantWebhookService(
      {} as Repository<MerchantWebhookDelivery>,
    );
    const payload = {
      id: 'evt_test',
      type: 'pay_with_tash.successful',
      createdAt: '2026-07-03T10:00:00.000Z',
      data: { reference: 'pwt_test' },
    };

    expect(service.signPayload('secret', '1783072800', payload)).toBe(
      createHmac('sha256', 'secret')
        .update(`1783072800.${JSON.stringify(payload)}`)
        .digest('hex'),
    );
  });

  it('enqueues deterministic delivery jobs', async () => {
    const queue = {
      add: jest
        .fn<
          Promise<unknown>,
          [string, MerchantWebhookDeliveryJobData, Record<string, unknown>]
        >()
        .mockResolvedValue({}),
    };
    const service = new MerchantWebhookService(
      {} as Repository<MerchantWebhookDelivery>,
      queue as unknown as Queue<MerchantWebhookDeliveryJobData>,
    );

    await service.enqueueDelivery(42);

    expect(queue.add).toHaveBeenCalledWith(
      'deliver-merchant-webhook',
      { deliveryId: 42 },
      expect.objectContaining({
        jobId: 'merchant-webhook-delivery-42',
        attempts: 5,
      }),
    );
  });
});
