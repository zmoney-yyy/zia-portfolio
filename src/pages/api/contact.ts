import type { APIRoute } from 'astro';
import { CONTACT } from '../../lib/config';
import { validateContact } from '../../lib/validate';
import { sendContactEmail } from '../../lib/email';
import { check, clientId } from '../../lib/ratelimit';
import { TURNSTILE_SECRET_KEY } from 'astro:env/server';
import { MAX_TOKEN_LENGTH, verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // JSON only: a cross-site form post can't send this content type without a CORS preflight.
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ ok: false, error: 'Unsupported request.' }, 415);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Unsupported request.' }, 400);
  }

  const parsed = validateContact(body);
  // Bots that fill the hidden field get a fake success and nothing is sent.
  if (parsed.ok && parsed.honeypot) return json({ ok: true });
  if (!parsed.ok) return json({ ok: false, errors: parsed.errors }, 422);

  const ip = clientId(request, clientAddress);
  const gate = await check(
    [{ name: 'contact', requests: CONTACT.perIp.requests, window: CONTACT.perIp.window }],
    ip,
  );
  if (gate === 'limited')
    return json({ ok: false, error: "You've sent a few messages already. Please try again later, or reach me on LinkedIn." }, 429);
  if (gate === 'unavailable')
    return json({ ok: false, error: "The form isn't available right now. Please reach me on LinkedIn." }, 503);

  // Human check, after validation and the rate limit (so junk never reaches Cloudflare) and
  // before any email is sent. In production a missing secret fails closed; local dev without
  // a secret skips the check so the form can be worked on offline.
  if (TURNSTILE_SECRET_KEY) {
    const raw = (body as { turnstileToken?: unknown }).turnstileToken;
    const token = typeof raw === 'string' ? raw.slice(0, MAX_TOKEN_LENGTH + 1) : '';
    const human = await verifyTurnstile({ secret: TURNSTILE_SECRET_KEY, token, ip });
    if (!human.ok && human.reason === 'invalid')
      return json({ ok: false, code: 'verification_failed', error: 'Verification failed. Please try again.' }, 403);
    if (!human.ok)
      return json({ ok: false, code: 'verification_unavailable', error: "We couldn't run the human check right now. Please try again in a moment, or reach me on LinkedIn." }, 503);
  } else if (import.meta.env.PROD) {
    console.error('contact: TURNSTILE_SECRET_KEY is not set; refusing to send');
    return json({ ok: false, error: "The form isn't available right now. Please reach me on LinkedIn." }, 503);
  }

  const sent = await sendContactEmail(parsed.value);
  if (!sent.ok)
    return json({ ok: false, error: "That didn't go through. Please try again, or reach me on LinkedIn." }, 502);

  return json({ ok: true });
};

// Anything but POST is refused.
export const ALL: APIRoute = () => json({ ok: false, error: 'Method not allowed.' }, 405);
