export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
  requestId: string;
}

export function successResponse<TData>(
  data: TData,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<TData> {
  return meta === undefined
    ? { success: true, data }
    : { success: true, data, meta };
}
