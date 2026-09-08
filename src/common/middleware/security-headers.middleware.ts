import { NextFunction, Request, Response } from 'express';

/**
 * Curated baseline security headers for every response (API Spec Security §22
 * Security Headers). Kept additive and deterministic (no CSP by default so it
 * never breaks a consumer; tighten per-deployment behind a CDN/proxy).
 */
const HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-XSS-Protection': '0', // modern guidance: disabled in favour of CSP
};

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of Object.entries(HEADERS)) {
    res.setHeader(name, value);
  }
  // Never advertise the framework.
  res.removeHeader('X-Powered-By');
  next();
}
