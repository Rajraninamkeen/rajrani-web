export interface AppConfig {
  env: string;
  port: number;
  apiBaseUrl: string;
  corsOrigins: string[];
  databaseUrl: string;
  redis: { url: string; host: string; port: number };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  logLevel: string;
  payments: {
    provider: string; // sandbox | razorpay
    razorpay: {
      keyId: string;
      keySecret: string;
      webhookSecret: string;
      baseUrl: string; // overridable (used to point at a local Razorpay-protocol mock)
    };
  };
  courier: {
    provider: string; // sandbox | http (Session 30 — external courier provider for tracking/POD)
    sandbox: { carrier: string };
    http: {
      carrier: string;
      baseUrl: string; // overridable (used to point at a local courier-protocol mock / real courier)
      apiKey: string; // secret; env-only, never committed
    };
    // Session 32 — per-delivered-leg courier fee (₹) the platform owes the DELIVERY partner.
    fees: { parcelFee: number; replacementFee: number };
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://bilokat:bilokat_dev@localhost:5432/bilokat?schema=public',
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
  },
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  payments: {
    provider: process.env.PAYMENT_GATEWAY_PROVIDER ?? 'sandbox',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
      baseUrl: process.env.RAZORPAY_BASE_URL ?? 'https://api.razorpay.com',
    },
  },
  courier: {
    provider: process.env.COURIER_PROVIDER ?? 'sandbox',
    sandbox: { carrier: process.env.COURIER_SANDBOX_CARRIER ?? 'Sandbox Courier' },
    http: {
      carrier: process.env.COURIER_CARRIER ?? 'External Courier',
      baseUrl: process.env.COURIER_BASE_URL ?? 'http://localhost:9600',
      apiKey: process.env.COURIER_API_KEY ?? '',
    },
    fees: {
      parcelFee: Number(process.env.COURIER_FEE_PARCEL ?? 35),
      replacementFee: Number(process.env.COURIER_FEE_REPLACEMENT ?? 40),
    },
  },
});
