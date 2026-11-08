import { CHAT, CONTACT } from './config';

export type ContactInput = { name: string; email: string; company: string; message: string };
export type ContactResult =
  | { ok: true; honeypot: false; value: ContactInput }
  | { ok: true; honeypot: true }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/;
// Strip control characters (including CR/LF) so values can never smuggle headers.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Single-line fields (name, email, company) also lose tabs and line breaks.
// eslint-disable-next-line no-control-regex
const LINE_BREAKS = /[\u0000-\u001F\u007F]/g;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function validateContact(body: unknown): ContactResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  // Honeypot: real people never see or fill this field.
  if (str(b.website).trim() !== '') return { ok: true, honeypot: true };

  const name = str(b.name).replace(LINE_BREAKS, ' ').trim();
  const email = str(b.email).replace(LINE_BREAKS, '').trim();
  const company = str(b.company).replace(LINE_BREAKS, ' ').trim();
  const message = str(b.message).replace(CONTROL, '').trim();

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > CONTACT.maxName) errors.name = 'That name is too long.';

  if (!email) errors.email = 'Please enter your email.';
  else if (email.length > CONTACT.maxEmail || !EMAIL_RE.test(email))
    errors.email = 'Please enter a valid email address.';

  if (company.length > CONTACT.maxCompany) errors.company = 'That company name is too long.';

  if (message.length < CONTACT.minMessage) errors.message = 'Please write a short message.';
  else if (message.length > CONTACT.maxMessage)
    errors.message = `Please keep your message under ${CONTACT.maxMessage} characters.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, honeypot: false, value: { name, email, company, message } };
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatResult = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

export function validateChat(body: unknown): ChatResult {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'No question was sent.' };

  const cleaned: ChatMessage[] = [];
  for (const m of raw.slice(-CHAT.maxHistoryMessages)) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Invalid message.' };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string')
      return { ok: false, error: 'Invalid message.' };
    cleaned.push({ role, content: content.replace(CONTROL, '').trim() });
  }

  const last = cleaned[cleaned.length - 1];
  if (last.role !== 'user' || !last.content) return { ok: false, error: 'No question was sent.' };
  if (last.content.length > CHAT.maxQuestionChars)
    return { ok: false, error: `Please keep questions under ${CHAT.maxQuestionChars} characters.` };

  // Earlier turns are client-supplied, so they are length-capped and must be non-empty.
  const history = cleaned.slice(0, -1).map((m) => ({
    ...m,
    content: m.content.slice(0, CHAT.maxHistoryChars),
  }));
  if (history.some((m) => !m.content)) return { ok: false, error: 'Invalid message.' };

  // The API wants the conversation to start with a user turn.
  while (history.length && history[0].role !== 'user') history.shift();
  return { ok: true, messages: [...history, last] };
}
