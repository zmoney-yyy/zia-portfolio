import { describe, expect, it } from 'vitest';
import { validateChat, validateContact } from './validate';

const good = { name: 'Ada', email: 'ada@example.com', company: '', message: 'Hello, we are hiring a PMM.' };

describe('validateContact', () => {
  it('accepts a normal message', () => {
    expect(validateContact(good)).toMatchObject({ ok: true, honeypot: false });
  });
  it('flags the honeypot without erroring', () => {
    expect(validateContact({ ...good, website: 'http://x' })).toEqual({ ok: true, honeypot: true });
  });
  it('rejects bad email, empty name and short message', () => {
    const r = validateContact({ name: ' ', email: 'nope', message: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name']);
  });
  it('strips newlines so values cannot inject headers', () => {
    const r = validateContact({ ...good, name: 'Ada\r\nBcc: x@y.com' });
    expect(r.ok && !r.honeypot && r.value.name).toBe('Ada  Bcc: x@y.com');
    expect(validateContact({ ...good, email: 'a@b.co\r\nBcc: x@y.com' }).ok).toBe(false);
  });
  it('enforces length limits and non-object bodies', () => {
    expect(validateContact({ ...good, message: 'a'.repeat(5001) }).ok).toBe(false);
    expect(validateContact(null).ok).toBe(false);
  });
});

describe('validateChat', () => {
  const u = (content: string) => ({ role: 'user', content });
  it('accepts a question and keeps a short history', () => {
    const r = validateChat({ messages: [u('a'), { role: 'assistant', content: 'b' }, u('c')] });
    expect(r.ok && r.messages.length).toBe(3);
  });
  it('rejects empty, oversize, bad role and assistant-last', () => {
    expect(validateChat({}).ok).toBe(false);
    expect(validateChat({ messages: [u('x'.repeat(501))] }).ok).toBe(false);
    expect(validateChat({ messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(validateChat({ messages: [{ role: 'assistant', content: 'x' }] }).ok).toBe(false);
  });
  it('caps history length and drops a leading assistant turn', () => {
    const msgs = Array.from({ length: 12 }, (_, i) => (i % 2 ? { role: 'assistant', content: 'a' } : u('q')));
    msgs.push(u('last'));
    const r = validateChat({ messages: msgs });
    expect(r.ok && r.messages.length).toBeLessThanOrEqual(6);
    expect(r.ok && r.messages[0].role).toBe('user');
  });
});
