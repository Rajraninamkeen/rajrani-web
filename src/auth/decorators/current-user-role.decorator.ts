import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Injects the authenticated user's role (string) into a handler param.
 * Fails if not authenticated (no req.auth.role). Used for audited high-authority
 * actions (e.g. Control Panel) where the acting role must be recorded.
 */
export const CurrentUserRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth?.role) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.auth.role;
  },
);
