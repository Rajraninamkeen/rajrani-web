import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COURIER_PROVIDER, type CourierProvider } from './courier-provider.interface';
import { SandboxCourierProvider } from './sandbox-courier.provider';
import { HttpCourierProvider } from './http-courier.provider';

/**
 * Selects the active courier provider from COURIER_PROVIDER (default sandbox)
 * and registers it behind the COURIER_PROVIDER token so DeliveryService /
 * ReplacementCourierService are injected with the real provider while unit
 * tests keep their historical `new X(prisma, …)` constructor shapes (provider
 * is injected @Optional).
 */
export const COURIER_PROVIDER_TOKEN: FactoryProvider<CourierProvider> = {
  provide: COURIER_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): CourierProvider => {
    const courier = config.get<{
      provider: string;
      sandbox: { carrier: string };
      http: { carrier: string; baseUrl: string; apiKey: string };
    }>('courier') ?? { provider: 'sandbox', sandbox: { carrier: 'Sandbox Courier' }, http: { carrier: 'External Courier', baseUrl: '', apiKey: '' } };
    if (courier.provider === 'http') {
      return new HttpCourierProvider({
        carrier: courier.http.carrier,
        baseUrl: courier.http.baseUrl,
        apiKey: courier.http.apiKey,
      });
    }
    return new SandboxCourierProvider(courier.sandbox.carrier);
  },
};
