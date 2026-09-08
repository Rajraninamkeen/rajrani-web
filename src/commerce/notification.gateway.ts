import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Session 39 — outbound gateway behind the Session-38 NotificationOutbox.
 *
 * Each outbound channel (EMAIL / SMS) resolves to one of two transports:
 *  - `console` (dev default): logs the rendered send and returns ok, so PENDING outbox
 *    rows move to SENT without any external dependency (observable in the API log).
 *  - `http` (real provider): POSTs JSON to a configured endpoint carrying the credentials.
 *
 * A row is therefore "delivered" to a provider (real or dev-sink) rather than being skipped.
 * Keeping the console sink as the default means the full enqueue→dispatch→SENT pipeline works
 * end-to-end locally, and pointing NOTIFY_*_TRANSPORT=http at a real gateway upgrades it with no
 * code change.
 */

export const NOTIFICATION_GATEWAY_TOKEN = 'NOTIFICATION_GATEWAY';

export type NotificationChannelId = 'EMAIL' | 'SMS';

export interface NotificationSendPayload {
  channel: NotificationChannelId;
  to: string;
  title: string; // subject for EMAIL
  message: string; // body (email) / text (sms)
}

export interface NotificationSendResult {
  ok: boolean;
  transport: 'console' | 'http';
  error?: string;
}

const DEFAULT_CONSOLE: Record<string, string> = {
  EMAIL: 'console',
  SMS: 'console',
};

@Injectable()
export class NotificationGateway {
  constructor(@Optional() private readonly config?: ConfigService) {}

  /** Best-effort attempt to read a config node (safe when ConfigService is absent). */
  private cfg() {
    return this.config?.get<any>('notify') ?? {};
  }

  private transportFor(channel: NotificationChannelId): string {
    const n = this.cfg();
    const t = channel === 'SMS' ? n?.sms?.transport : n?.email?.transport;
    return (typeof t === 'string' && t.trim() ? t : DEFAULT_CONSOLE[channel]) as string;
  }

  private endpointFor(channel: NotificationChannelId): { url: string; key: string } {
    const n = this.cfg();
    const c = channel === 'SMS' ? n?.sms : n?.email;
    return { url: c?.httpUrl ?? '', key: c?.httpKey ?? '' };
  }

  async send(p: NotificationSendPayload): Promise<NotificationSendResult> {
    const transport = this.transportFor(p.channel);
    if (transport === 'http') {
      const { url, key } = this.endpointFor(p.channel);
      if (!url) return { ok: false, transport: 'http', error: 'http provider url not configured' };
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({
            channel: p.channel,
            to: p.to,
            subject: p.channel === 'EMAIL' ? p.title : undefined,
            body: p.channel === 'EMAIL' ? p.message : undefined,
            text: p.channel === 'SMS' ? p.message : undefined,
            sender: this.cfg()?.[p.channel === 'SMS' ? 'sms' : 'email']?.from,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          return { ok: false, transport: 'http', error: `provider http ${res.status}` };
        }
        return { ok: true, transport: 'http' };
      } catch (e: any) {
        return { ok: false, transport: 'http', error: e?.message ?? 'http send error' };
      }
    }
    // console dev-sink: render + log the outbound message.
    // eslint-disable-next-line no-console
    console.log(`[bilokat-notify:dev] ${p.channel} → ${p.to} :: ${p.channel === 'EMAIL' ? p.title + ' — ' + p.message : p.message}`);
    return { ok: true, transport: 'console' };
  }
}
