import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AccessTokenPayload } from '../auth.types';

/**
 * Verifies a bearer access token WHEN one is present, attaching the payload to
 * req.auth. Unlike JwtAuthGuard it does NOT reject anonymous requests — useful
 * for guest-flows (e.g. cart) that work for both guests and signed-in users.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extract(request);
    if (!token) return true;
    try {
      const secret = this.config.get<string>('jwt.accessSecret') ?? '';
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret });
      if (payload.type === 'access') {
        request.auth = payload;
      }
    } catch {
      // Invalid/expired token on an optional route is ignored (guest continues).
    }
    return true;
  }

  private extract(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
