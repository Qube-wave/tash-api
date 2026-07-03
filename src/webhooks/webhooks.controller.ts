import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MockVirtualAccountFundingWebhookDto } from './dto/mock-virtual-account-funding.dto';
import { WebhookProcessingResponse, WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks/payment-providers')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('mock/virtual-account-funding')
  processMockVirtualAccountFunding(
    @Body() dto: MockVirtualAccountFundingWebhookDto,
  ): Promise<WebhookProcessingResponse> {
    return this.webhooksService.processMockVirtualAccountFunding(dto);
  }
}
