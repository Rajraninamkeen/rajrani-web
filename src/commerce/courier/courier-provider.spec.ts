import { SandboxCourierProvider } from './sandbox-courier.provider';
import { HttpCourierProvider } from './http-courier.provider';
import { COURIER_PROVIDER, CourierShipmentInput } from './courier-provider.interface';

const input: CourierShipmentInput = {
  ref: 'DLVA-ABCD1234',
  kind: 'parcel',
  description: 'Bilokat Royal Ratlami Sev x1',
  recipientName: 'Priya Sharma',
  phone: '9876500111',
  city: 'Kanpur',
  state: 'UP',
  pincode: '208001',
};

describe('courier provider layer (Session 30)', () => {
  it('sandbox provider issues a deterministic, idempotent waybill', async () => {
    const p = new SandboxCourierProvider('Sandbox Courier');
    const a = await p.createShipment(input);
    const b = await p.createShipment({ ...input });
    expect(a.carrier).toBe('Sandbox Courier');
    expect(a.trackingNumber).toMatch(/^SWB-[A-F0-9]{8}$/);
    expect(b.trackingNumber).toBe(a.trackingNumber); // idempotent on ref
    expect(a.status).toBe('CREATED');
  });

  it('sandbox provider tracking returns a terminal DELIVERED timeline', async () => {
    const p = new SandboxCourierProvider();
    const t = await p.track('SWB-ABC');
    expect(t.status).toBe('DELIVERED');
    expect(t.events.map((e) => e.status)).toEqual([
      'CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ]);
  });

  it('sandbox provider confirms a deterministic POD on the final leg', async () => {
    const p = new SandboxCourierProvider('Sandbox Courier');
    const pod = await p.confirmDelivery('SWB-ABC');
    expect(pod.podRef).toBe('POD-SWB-ABC');
    expect(pod.signedBy).toBe('Sandbox Courier');
    expect(new Date(pod.at).getTime()).not.toBeNaN();
  });

  it('exposes the COURIER_PROVIDER DI token symbol', () => {
    expect(typeof COURIER_PROVIDER).toBe('symbol');
  });

  it('http provider rejects when no base URL is configured', async () => {
    const p = new HttpCourierProvider({ carrier: 'X', baseUrl: '', apiKey: '' });
    await expect(p.createShipment(input)).rejects.toThrow('COURIER_BASE_URL is not configured');
  });

  it('http provider sends a shipment against a reachable courier endpoint', async () => {
    // Tiny in-process mock server speaking the courier contract.
    const server = (await import('node:http')).createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (req.url === '/v1/shipments' && req.method === 'POST') {
          const payload = JSON.parse(body);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            carrier: 'Mock Courier',
            trackingNumber: `MCK-${payload.ref}`,
            status: 'CREATED',
          }));
          return;
        }
        const tn = /\/v1\/shipments\/([^/]+)\/pod/.exec(req.url!);
        if (tn && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ podRef: `POD-${tn[1]}`, signedBy: 'Mock Courier', at: new Date().toISOString() }));
          return;
        }
        res.writeHead(404); res.end('{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const p = new HttpCourierProvider({
        carrier: 'Mock Courier',
        baseUrl: `http://127.0.0.1:${port}`,
        apiKey: 'sek',
      });
      const ship = await p.createShipment(input);
      expect(ship.carrier).toBe('Mock Courier');
      expect(ship.trackingNumber).toBe(`MCK-${input.ref}`);
      const pod = await p.confirmDelivery(ship.trackingNumber);
      expect(pod.podRef).toBe(`POD-${ship.trackingNumber}`);
    } finally {
      server.close();
    }
  });
});
