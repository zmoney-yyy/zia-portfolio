import { describe, expect, it, vi } from 'vitest';
import { MAX_TOKEN_LENGTH, SITEVERIFY_URL, verifyTurnstile } from './turnstile';

// Fake values only. Real keys never appear in the repo.
const secret = 'fake-secret-for-tests';
const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('verifyTurnstile', () => {
  it('posts the secret, token and ip to siteverify and accepts success', async () => {
    const f = reply({ success: true });
    const r = await verifyTurnstile({ secret, token: 'tok', ip: '203.0.113.9', fetchImpl: f });
    expect(r).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe(secret);
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.9');
  });

  it('omits remoteip when the address is unknown', async () => {
    const f = reply({ success: true });
    await verifyTurnstile({ secret, token: 'tok', ip: 'unknown', fetchImpl: f });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.body as URLSearchParams).has('remoteip')).toBe(false);
  });

  it('rejects a failed, expired or reused token as invalid', async () => {
    for (const code of ['invalid-input-response', 'timeout-or-duplicate']) {
      const r = await verifyTurnstile({ secret, token: 't', fetchImpl: reply({ success: false, 'error-codes': [code] }) });
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('rejects an empty or oversized token without calling Cloudflare', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile({ secret, token: '', fetchImpl: f })).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyTurnstile({ secret, token: 'x'.repeat(MAX_TOKEN_LENGTH + 1), fetchImpl: f })).toEqual({ ok: false, reason: 'invalid' });
    expect(f).not.toHaveBeenCalled();
  });

  it('fails closed as unavailable on network errors, HTTP errors and our own misconfiguration', async () => {
    const boom = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ secret, token: 't', fetchImpl: boom })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await verifyTurnstile({ secret, token: 't', fetchImpl: reply({}, 500) })).toEqual({ ok: false, reason: 'unavailable' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = reply({ success: false, 'error-codes': ['invalid-input-secret'] });
    expect(await verifyTurnstile({ secret, token: 't', fetchImpl: bad })).toEqual({ ok: false, reason: 'unavailable' });
    expect(spy).toHaveBeenCalledWith('contact: turnstile siteverify error', 'invalid-input-secret');
    expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
    spy.mockRestore();
  });

  it('treats a non-JSON reply as not verified', async () => {
    const html = vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    expect(await verifyTurnstile({ secret, token: 't', fetchImpl: html })).toEqual({ ok: false, reason: 'invalid' });
  });
});
