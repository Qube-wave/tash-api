import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code';

export interface AppExceptionResponse {
  code: ErrorCode;
  message: string;
  details: unknown;
}

export class AppException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details: unknown = null,
  ) {
    super(
      { code, message, details } satisfies AppExceptionResponse,
      statusCode,
    );
  }
}
