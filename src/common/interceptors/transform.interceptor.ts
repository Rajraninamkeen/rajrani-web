import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiMeta, SuccessResponse } from '../api-response/api-response';

/**
 * Wraps every successful response into the standard envelope:
 * { success: true, data, meta }
 * Paginated results already carry `data` and `meta` — we pass through.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T> | { success: true; data: T; meta?: ApiMeta }>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T> | { success: true; data: T; meta?: ApiMeta }> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'success' in payload &&
          (payload as { success: boolean }).success === true
        ) {
          return payload as SuccessResponse<T>;
        }
        // Standard data return
        return { success: true, data: payload as T };
      }),
    );
  }
}
