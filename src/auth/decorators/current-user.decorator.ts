import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Injects the authenticated user's id (string) into a handler param.
 * Fails if the request is not authenticated (no req.auth).
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth?.sub) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.auth.sub;
  },
);
