import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway.interface';
import { SandboxGateway } from './sandbox.gateway';
import { RazorpayGateway, type RazorpayGatewayConfig } from './razorpay.gateway';

/**
 * Selects the active gateway from PAYMENT_GATEWAY_PROVIDER (default sandbox).
 * Registers it behind the PAYMENT_GATEWAY token so PaymentService / refund
 * seams are injected with the real provider while unit tests keep their
 * historical `new X(prisma)` constructor shape.
 */
export const PAYMENT_GATEWAY_PROVIDER: FactoryProvider<PaymentGateway> = {
  provide: PAYMENT_GATEWAY,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PaymentGateway => {
    const provider = config.get<string>('payments.provider') ?? 'sandbox';
    if (provider === 'razorpay') {
      const rp = config.get<Record<string, string>>('payments.razorpay') ?? {};
      const rpConfig: RazorpayGatewayConfig = {
        keyId: rp.keyId ?? '',
        keySecret: rp.keySecret ?? '',
        webhookSecret: rp.webhookSecret ?? '',
        baseUrl: rp.baseUrl ?? 'https://api.razorpay.com',
      };
      return new RazorpayGateway(rpConfig);
    }
    return new SandboxGateway();
  },
};
