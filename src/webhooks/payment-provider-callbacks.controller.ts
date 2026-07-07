import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SkipRateLimit } from '../common/rate-limits/skip-rate-limit.decorator';
import { WebhookProcessingResponse, WebhooksService } from './webhooks.service';

type WebhookRequest = RawBodyRequest<Request>;

@ApiTags('payment-providers')
@Controller('payment-providers')
export class PaymentProviderCallbacksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba/callback')
  @SkipRateLimit()
  @HttpCode(HttpStatus.OK)
  processNombaCallback(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: WebhookRequest,
    @Body() payload: unknown,
  ): Promise<WebhookProcessingResponse> {
    return this.webhooksService.processProviderWebhook({
      providerName: 'nomba',
      headers,
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(payload ?? {})),
      payload,
    });
  }
}
