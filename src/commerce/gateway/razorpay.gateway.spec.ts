import { ForbiddenException } from '@nestjs/common';
import { RazorpayGateway } from './razorpay.gateway';
import { SandboxGateway } from './sandbox.gateway';
import { createHmac } from 'node:crypto';

function buildGw(baseUrl: string): RazorpayGateway {
  return new RazorpayGateway({
    keyId: 'rzp_test_keyid',
    keySecret: 'keysecret',
    webhookSecret: 'whsec_test',
    baseUrl,
  });
}

describe('RazorpayGateway', () => {
  let fetchMock: jest.Mock;
  let gw: RazorpayGateway;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    gw = buildGw('https://api.razorpay.test');
  });

  it('is provider razorpay and creates an order with amount in paise + idempotent receipt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'order_ABC', entity: 'order', amount: 50000, currency: 'INR' }),
    });
    const out = await gw.createGatewayIntent({ receipt: 'order-123', amount: 500, currency: 'INR' });
    expect(out.gatewayOrderId).toBe('order_ABC');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.razorpay.test/v1/orders');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.amount).toBe(50000); // paise
    expect(body.receipt).toBe('order-123');
    expect(body.payment_capture).toBe(1);
    const auth = init.headers.Authorization;
    expect(auth.startsWith('Basic ')).toBe(true);
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    expect(decoded).toBe('rzp_test_keyid:keysecret');
  });

  it('propagates a gateway error as a request failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { code: 'BAD_REQUEST_ERROR', description: 'nope' } }),
    });
    await expect(gw.createGatewayIntent({ receipt: 'r', amount: 1, currency: 'INR' })).rejects.toThrow(/Razorpay/);
  });

  it('verifies a raw-body webhook (HMAC over the exact bytes) and normalises payment.captured', async () => {
    const eventType = 'payment.captured';
    const entity = { id: 'pay_LIVE', entity: 'payment', amount: 50000, currency: 'INR', order_id: 'order_ABC', status: 'captured' };
    const payload = { event: eventType, payload: { payment: { entity } } };
    const raw = Buffer.from(JSON.stringify(payload));
    const sig = createHmac('sha256', 'whsec_test').update(raw).digest('hex');
    const ev = await gw.parseWebhook({ rawBody: raw, signature: sig });
    expect(ev.provider).toBe('razorpay');
    expect(ev.eventType).toBe('payment.captured');
    expect(ev.amount).toBe(500);
    expect(ev.gatewayPaymentId).toBe('pay_LIVE');
    expect(ev.gatewayOrderId).toBe('order_ABC');
    expect(ev.providerEventId).toContain('pay_LIVE');
  });

  it('rejects a webhook with an invalid signature', async () => {
    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
    await expect(gw.parseWebhook({ rawBody: raw, signature: 'deadbeef' })).rejects.toThrow(ForbiddenException);
  });

  it('executes a real refund (POST /v1/payments/:id/refund) and returns the rfnd id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'rfnd_ZZZ', entity: 'refund', amount: 20000, currency: 'INR', status: 'processed' }),
    });
    const res = await gw.refund({ gatewayPaymentId: 'pay_LIVE', amount: 200, currency: 'INR', receipt: 'RFD-1' });
    expect(res.gatewayRef).toBe('rfnd_ZZZ');
    expect(res.status).toBe('COMPLETED');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.razorpay.test/v1/payments/pay_LIVE/refund');
    const body = JSON.parse(init.body);
    expect(body.amount).toBe(20000);
  });
});

describe('SandboxGateway (default provider)', () => {
  it('is provider sandbox, creates no external order and fabricates refund refs (no network)', async () => {
    const sg = new SandboxGateway();
    expect(sg.provider).toBe('sandbox');
    const intent = await sg.createGatewayIntent({ receipt: 'x', amount: 100, currency: 'INR' });
    expect(intent.gatewayOrderId).toBeNull();
    const r = await sg.refund({ gatewayPaymentId: 'p', amount: 10, currency: 'INR', receipt: 'r' });
    expect(r.status).toBe('COMPLETED');
    expect(r.gatewayRef).toContain('sndbox-refund');
  });
});
