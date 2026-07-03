import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedMerchant } from './merchant-authenticated';
import { MerchantRequest } from './guards/merchant-api-key.guard';

export const CurrentMerchant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedMerchant => {
    const request = context.switchToHttp().getRequest<MerchantRequest>();
    if (request.merchantAuth === undefined) {
      throw new Error('Merchant authentication context is missing.');
    }

    return request.merchantAuth;
  },
);
