import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AccessTokenPayload } from '../auth.types';

/** Reads `Authorization: Bearer <accessToken>` and attaches the payload to req.auth. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extract(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const secret = this.config.get<string>('jwt.accessSecret') ?? '';
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret });
      if (payload.type !== 'access') {
        throw new Error('Not an access token');
      }
      request.auth = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extract(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
