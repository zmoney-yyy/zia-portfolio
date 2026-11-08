import type { APIRoute } from 'astro';
import { CONTACT } from '../../lib/config';
import { validateContact } from '../../lib/validate';
import { sendContactEmail } from '../../lib/email';
import { check, clientId } from '../../lib/ratelimit';

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

  const gate = await check(
    [{ name: 'contact', requests: CONTACT.perIp.requests, window: CONTACT.perIp.window }],
    clientId(request, clientAddress),
  );
  if (gate === 'limited')
    return json({ ok: false, error: "You've sent a few messages already. Please try again later, or reach me on LinkedIn." }, 429);
  if (gate === 'unavailable')
    return json({ ok: false, error: "The form isn't available right now. Please reach me on LinkedIn." }, 503);

  const sent = await sendContactEmail(parsed.value);
  if (!sent.ok)
    return json({ ok: false, error: "That didn't go through. Please try again, or reach me on LinkedIn." }, 502);

  return json({ ok: true });
};

// Anything but POST is refused.
export const ALL: APIRoute = () => json({ ok: false, error: 'Method not allowed.' }, 405);
