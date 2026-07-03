import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('normalizes HTTP exceptions into the API error shape', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'req_test',
          method: 'GET',
          originalUrl: '/missing',
        }),
        getResponse: () => ({
          status,
          json,
        }),
      }),
    } as ArgumentsHost;

    new ApiExceptionFilter().catch(
      new HttpException('Missing', HttpStatus.NOT_FOUND),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Missing',
        details: null,
      },
      requestId: 'req_test',
    });
  });
});
