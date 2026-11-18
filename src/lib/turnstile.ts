// Server-side verification of a Cloudflare Turnstile token. The secret is passed in (read from
// env by the caller) so this module stays free of Astro imports and easy to unit test.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const MAX_TOKEN_LENGTH = 2048; // Cloudflare's documented limit

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' } // the visitor's token was missing, wrong, expired or reused
  | { ok: false; reason: 'unavailable' }; // Cloudflare unreachable, or our secret is misconfigured

// Error codes that mean the problem is on our side, not the visitor's.
const OUR_FAULT = new Set(['missing-input-secret', 'invalid-input-secret', 'internal-error']);

export async function verifyTurnstile(opts: {
  secret: string;
  token: string;
  ip?: string;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileResult> {
  const { secret, token, ip, fetchImpl = fetch } = opts;
  if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'invalid' };

  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  let res: Response;
  try {
    res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!res.ok) return { ok: false, reason: 'unavailable' };

  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    'error-codes'?: string[];
  } | null;
  if (data?.success === true) return { ok: true };

  const codes = data?.['error-codes'] ?? [];
  // Log codes only (never the token or the secret) so a misconfiguration is visible in Vercel logs.
  if (codes.some((c) => OUR_FAULT.has(c))) {
    console.error('contact: turnstile siteverify error', codes.join(','));
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: false, reason: 'invalid' };
}
