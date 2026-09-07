import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Ensures every request carries a request id (inbound X-Request-Id honored,
 * otherwise generated), and echoes it on the response. Used for traceability
 * and correlation (API Spec §8 Request ID, §9 Correlation ID).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = (req.headers['x-request-id'] as string) || undefined;
  const id = inbound && inbound.length <= 64 ? inbound : randomUUID();
  (req as unknown as { requestId: string }).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
