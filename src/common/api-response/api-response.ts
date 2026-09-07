// Standard API envelope (PROJECT-DOCS/04-API-SPECIFICATION.md §18–§19).
// Success:  { success: true,  data, meta? }
// Error:    { success: false, error: { code, message, details?, requestId, path, timestamp } }

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    path?: string;
    timestamp: string;
  };
}

/** Central catalog of stable, machine-readable error codes. */
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE: 'UNPROCESSABLE',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;
