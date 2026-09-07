import 'express';
import { AccessTokenPayload } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload; // set by JwtAuthGuard after verification
    }
  }
}

export {};
