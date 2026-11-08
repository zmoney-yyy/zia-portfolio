import { RESEND_API_KEY, RESEND_FROM, CONTACT_TO_EMAIL } from 'astro:env/server';
import type { ContactInput } from './validate';

export type SendResult = { ok: true } | { ok: false; reason: 'not_configured' | 'provider_error' };

/** Sends a plain-text message through Resend. The destination only ever lives in env vars. */
export async function sendContactEmail(c: ContactInput): Promise<SendResult> {
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) return { ok: false, reason: 'not_configured' };

  const text = [
    `Name: ${c.name}`,
    `Email: ${c.email}`,
    `Company: ${c.company || '(not given)'}`,
    '',
    c.message,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM || 'Portfolio contact <onboarding@resend.dev>',
        to: [CONTACT_TO_EMAIL],
        reply_to: c.email,
        subject: `Portfolio contact: ${c.name}${c.company ? ` (${c.company})` : ''}`.slice(0, 200),
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('contact: resend responded', res.status);
      return { ok: false, reason: 'provider_error' };
    }
    return { ok: true };
  } catch (err) {
    console.error('contact: resend request failed', err instanceof Error ? err.name : 'error');
    return { ok: false, reason: 'provider_error' };
  }
}
