// Exercises the real /api/contact handler with the rate limiter, Cloudflare and Resend mocked,
// to pin down the ORDER of the checks: validation -> rate limit -> Turnstile -> email.
// Lives in src/lib (not src/pages) so Astro doesn't treat it as a route.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  secret: 'fake-secret' as string | undefined,
  check: vi.fn(),
  verify: vi.fn(),
  send: vi.fn(),
}));

vi.mock('astro:env/server', () => ({
  get TURNSTILE_SECRET_KEY() {
    return m.secret;
  },
  SITE_INDEXABLE: undefined,
}));
vi.mock('../lib/ratelimit', () => ({ check: m.check, clientId: () => '203.0.113.7' }));
vi.mock('../lib/turnstile', async (orig) => ({ ...(await orig<object>()), verifyTurnstile: m.verify }));
vi.mock('../lib/email', () => ({ sendContactEmail: m.send }));

import { POST } from '../pages/api/contact';

const good = { name: 'Ada', email: 'ada@example.com', company: '', message: 'Hello, we are hiring a PMM.' };
const call = (body: unknown) =>
  POST({
    request: new Request('http://x/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    clientAddress: '198.51.100.1',
  } as never);

beforeEach(() => {
  m.secret = 'fake-secret';
  m.check.mockReset().mockResolvedValue('ok');
  m.verify.mockReset().mockResolvedValue({ ok: true });
  m.send.mockReset().mockResolvedValue({ ok: true });
});

describe('/api/contact', () => {
  it('verifies the token with the secret, then sends exactly one email', async () => {
    const res = await call({ ...good, turnstileToken: 'tok' });
    expect(res.status).toBe(200);
    expect(m.verify).toHaveBeenCalledWith({ secret: 'fake-secret', token: 'tok', ip: '203.0.113.7' });
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.verify.mock.invocationCallOrder[0]).toBeLessThan(m.send.mock.invocationCallOrder[0]);
  });

  it('rejects with 403 and sends NO email when verification fails', async () => {
    m.verify.mockResolvedValue({ ok: false, reason: 'invalid' });
    const res = await call({ ...good, turnstileToken: 'bad' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, code: 'verification_failed' });
    expect(m.send).not.toHaveBeenCalled();
  });

  it('sends NO email when Cloudflare is unreachable or the secret is misconfigured (503)', async () => {
    m.verify.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const res = await call({ ...good, turnstileToken: 'tok' });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'verification_unavailable' });
    expect(m.send).not.toHaveBeenCalled();
  });

  it('treats a missing or non-string token as a failed check', async () => {
    m.verify.mockResolvedValue({ ok: false, reason: 'invalid' });
    for (const t of [undefined, 42, { a: 1 }]) {
      const res = await call({ ...good, turnstileToken: t });
      expect(res.status).toBe(403);
    }
    expect(m.verify.mock.calls.every(([a]) => a.token === '')).toBe(true);
    expect(m.send).not.toHaveBeenCalled();
  });

  it('rate limit still applies: a limited caller never reaches Cloudflare or Resend', async () => {
    m.check.mockResolvedValue('limited');
    const res = await call({ ...good, turnstileToken: 'tok' });
    expect(res.status).toBe(429);
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it('fails closed when the rate-limit store is unavailable', async () => {
    m.check.mockResolvedValue('unavailable');
    const res = await call({ ...good, turnstileToken: 'tok' });
    expect(res.status).toBe(503);
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it('validation still applies: bad fields get 422 before the limiter, Cloudflare or Resend', async () => {
    const res = await call({ name: '', email: 'nope', message: 'hi', turnstileToken: 'tok' });
    expect(res.status).toBe(422);
    expect(m.check).not.toHaveBeenCalled();
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it('honeypot still applies: a filled hidden field gets a fake success and nothing runs', async () => {
    const res = await call({ ...good, website: 'http://spam', turnstileToken: 'tok' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.check).not.toHaveBeenCalled();
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it('local dev without a secret skips the check; production without one refuses to send', async () => {
    m.secret = undefined;
    expect((await call({ ...good })).status).toBe(200);
    expect(m.verify).not.toHaveBeenCalled();
    m.send.mockClear();
    vi.stubEnv('PROD', true);
    const res = await call({ ...good });
    vi.unstubAllEnvs();
    expect(res.status).toBe(503);
    expect(m.send).not.toHaveBeenCalled();
  });

  it('keeps the noindex X-Robots-Tag header on the new Turnstile responses', async () => {
    m.verify.mockResolvedValue({ ok: false, reason: 'invalid' });
    const res = await call({ ...good, turnstileToken: 'bad' });
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive, nosnippet, noimageindex');
  });
});
