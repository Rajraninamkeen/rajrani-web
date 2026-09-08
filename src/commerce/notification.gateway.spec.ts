import { NotificationGateway } from './notification.gateway';

const fakeConfig = (notify: any) => ({ get: (k: string) => (k === 'notify' ? notify : undefined) }) as any;

describe('NotificationGateway (Session 39 — outbound SMS/email transport)', () => {
  it('uses the console dev-sink by default and returns ok', async () => {
    const gw = new NotificationGateway(fakeConfig({ email: { transport: 'console' }, sms: { transport: 'console' } }));
    const res = await gw.send({ channel: 'EMAIL', to: 'a@b.co', title: 'T', message: 'M' });
    expect(res).toEqual({ ok: true, transport: 'console' });
  });

  it('POSTs to the http provider when configured', async () => {
    const gw = new NotificationGateway(fakeConfig({
      email: { transport: 'http', httpUrl: 'https://mail.example.dev/send', httpKey: 'k123' },
      sms: { transport: 'console' },
    }));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as any).fetch = fetchMock;
    const res = await gw.send({ channel: 'EMAIL', to: 'a@b.co', title: 'Payout received', message: '₹35 paid out.' });
    expect(res).toEqual({ ok: true, transport: 'http' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mail.example.dev/send');
    expect(opts.headers.Authorization).toBe('Bearer k123');
    const body = JSON.parse(opts.body);
    expect(body.subject).toBe('Payout received');
    expect(body.channel).toBe('EMAIL');
  });

  it('returns ok:false when the provider answers non-2xx', async () => {
    const gw = new NotificationGateway(fakeConfig({
      sms: { transport: 'http', httpUrl: 'https://sms.example.dev/send', httpKey: 'k' },
      email: { transport: 'console' },
    }));
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const res = await gw.send({ channel: 'SMS', to: '9900000099', title: '', message: 'Delivery fee paid' });
    expect(res.ok).toBe(false);
    expect(res.transport).toBe('http');
    expect(res.error).toContain('500');
  });

  it('fails cleanly when http transport has no url configured', async () => {
    const gw = new NotificationGateway(fakeConfig({ email: { transport: 'http', httpUrl: '', httpKey: '' }, sms: { transport: 'console' } }));
    const res = await gw.send({ channel: 'EMAIL', to: 'a@b.co', title: 'T', message: 'M' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('url not configured');
  });
});
