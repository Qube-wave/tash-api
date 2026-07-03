import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { AuthenticatedMerchant } from '../merchant-authenticated';
import { MerchantsService } from '../merchants.service';

export interface MerchantRequest extends Request {
  merchantAuth?: AuthenticatedMerchant;
}

@Injectable()
export class MerchantApiKeyGuard implements CanActivate {
  constructor(private readonly merchantsService: MerchantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MerchantRequest>();
    const authorization = request.header('authorization');
    const apiKey = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : request.header('x-tash-merchant-key');

    if (apiKey === undefined || apiKey.trim() === '') {
      throw new AppException(
        ErrorCode.InvalidCredentials,
        'Merchant API key is required.',
        401,
      );
    }

    request.merchantAuth =
      await this.merchantsService.authenticateApiKey(apiKey);
    return true;
  }
}
