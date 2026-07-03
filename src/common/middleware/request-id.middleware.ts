import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId: string;
}

function getRequestIdHeader(request: Request): string | undefined {
  const header = request.header('x-request-id');

  if (header === undefined || header.length > 128) {
    return undefined;
  }

  return header;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = getRequestIdHeader(request) ?? `req_${randomUUID()}`;
    (request as RequestWithId).requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
