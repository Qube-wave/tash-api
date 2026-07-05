import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-code';
import { RequestWithId } from '../middleware/request-id.middleware';
import { ApiErrorResponse } from '../responses/api-response';

interface NormalizedError {
  code: ErrorCode;
  message: string;
  details: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapHttpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.BadRequest;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NotFound;
    default:
      return ErrorCode.InternalServerError;
  }
}

function normalizeHttpException(exception: HttpException): NormalizedError {
  const response = exception.getResponse();

  if (isRecord(response) && typeof response.code === 'string') {
    return {
      code: response.code as ErrorCode,
      message:
        typeof response.message === 'string'
          ? response.message
          : 'Request failed.',
      details: response.details ?? null,
    };
  }

  if (isRecord(response) && Array.isArray(response.message)) {
    return {
      code: ErrorCode.ValidationFailed,
      message: 'Request validation failed.',
      details: response.message,
    };
  }

  return {
    code: mapHttpStatusToErrorCode(exception.getStatus()),
    message: typeof response === 'string' ? response : exception.message,
    details: null,
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId & Request>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? 'req_unavailable';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized =
      exception instanceof HttpException
        ? normalizeHttpException(exception)
        : {
            code: ErrorCode.InternalServerError,
            message: 'An unexpected error occurred.',
            details: null,
          };

    if (status >= 500) {
      const message =
        exception instanceof Error ? exception.message : 'Unknown exception';
      this.logger.error(
        `${request.method} ${request.originalUrl} failed: ${message}`,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: normalized,
      requestId,
    };

    response.status(status).json(body);
  }
}
