import { securityHeadersMiddleware } from './security-headers.middleware';

describe('securityHeadersMiddleware', () => {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    removeHeader: (k: string) => { delete headers[k]; },
  };
  const req = {} as any;
  let next: jest.Mock;

  beforeEach(() => {
    for (const k of Object.keys(headers)) delete headers[k];
    next = jest.fn();
  });

  it('sets baseline security headers', () => {
    securityHeadersMiddleware(req, res as any, next);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('does not advertise the framework and calls next()', () => {
    securityHeadersMiddleware(req, res as any, next);
    expect(headers['X-Powered-By']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
