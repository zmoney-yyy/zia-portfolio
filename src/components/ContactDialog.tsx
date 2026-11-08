import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';

type Status = 'idle' | 'sending' | 'success' | 'error';
type Fields = { name: string; email: string; company: string; message: string; website: string };
const EMPTY: Fields = { name: '', email: '', company: '', message: '', website: '' };

const inputCls =
  'box-border w-full min-h-12 rounded-[10px] border border-ink bg-white px-3.5 py-3 text-base text-ink focus:outline-[3px] focus:outline-offset-1 focus:outline-sun';

export default function ContactDialog({ linkedin }: { linkedin: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Any element with [data-open-contact] (nav, footer, chat fallback) opens the dialog.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as Element | null)?.closest('[data-open-contact]');
      if (!trigger) return;
      e.preventDefault();
      if (status === 'success') reset();
      ref.current?.showModal();
      document.body.style.overflow = 'hidden';
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [status]);

  function reset() {
    setFields(EMPTY);
    setErrors({});
    setFormError('');
    setStatus('idle');
  }

  const close = () => ref.current?.close();
  const onClosed = () => {
    document.body.style.overflow = '';
  };

  // showModal() makes the page behind inert, but Tab can still leave for the browser's own UI.
  // Keep focus cycling inside the dialog.
  function trapTab(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])',
      ),
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !ref.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function set<K extends keyof Fields>(k: K, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // React clears currentTarget after the first await
    if (status === 'sending') return;
    setStatus('sending');
    setFormError('');
    setErrors({});
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus('success');
        return;
      }
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus('idle');
        const first = ['name', 'email', 'company', 'message'].find((k) => data.errors[k]);
        if (first) form.querySelector<HTMLElement>(`#cf-${first}`)?.focus();
        return;
      }
      setFormError(data.error || "That didn't go through. Please try again.");
      setStatus('error');
    } catch {
      setFormError("That didn't go through. Please check your connection and try again.");
      setStatus('error');
    }
  }

  const err = (k: string) => (errors[k] ? `cf-${k}-err` : undefined);

  return (
    <dialog
      ref={ref}
      aria-labelledby="contact-title"
      onClose={onClosed}
      onKeyDown={trapTab}
      onClick={(e) => {
        if (e.target === ref.current) close(); // click on the backdrop
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[520px] overflow-visible rounded-[18px] border border-ink bg-card p-0 text-ink shadow-[8px_8px_0_var(--color-sun)] backdrop:bg-ink/55"
    >
      <div className="relative max-h-[calc(100dvh-48px)] overflow-y-auto p-8">
        <button
          type="button"
          onClick={close}
          aria-label="Close contact form"
          className="absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[26px] leading-none text-ink"
        >
          <span aria-hidden="true">&times;</span>
        </button>

        <h2 id="contact-title" className="display mb-2 pr-10 text-[32px] leading-[1.1] tracking-[-0.015em]">
          Contact me
        </h2>

        {status === 'success' ? (
          <div role="status">
            <p className="mb-6 text-base text-ink-2">
              Thanks, your message is on its way. I'll get back to you soon.
            </p>
            <button type="button" onClick={close} className="btn btn-solid">
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-base text-ink-2">
              Tell me a bit about the role or what you'd like to talk about. I'll get back to you.
            </p>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <Field id="cf-name" label="Your name" error={errors.name} errId={err('name')}>
                <input
                  id="cf-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={fields.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={err('name')}
                  className={inputCls}
                />
              </Field>
              <Field id="cf-email" label="Your email" error={errors.email} errId={err('email')}>
                <input
                  id="cf-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={200}
                  value={fields.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={err('email')}
                  className={inputCls}
                />
              </Field>
              <Field
                id="cf-company"
                label={
                  <>
                    Company <span className="font-normal text-muted">(optional)</span>
                  </>
                }
                error={errors.company}
                errId={err('company')}
              >
                <input
                  id="cf-company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  maxLength={100}
                  value={fields.company}
                  onChange={(e) => set('company', e.target.value)}
                  aria-invalid={!!errors.company}
                  aria-describedby={err('company')}
                  className={inputCls}
                />
              </Field>
              <Field id="cf-message" label="Message" error={errors.message} errId={err('message')}>
                <textarea
                  id="cf-message"
                  name="message"
                  rows={5}
                  required
                  maxLength={5000}
                  value={fields.message}
                  onChange={(e) => set('message', e.target.value)}
                  aria-invalid={!!errors.message}
                  aria-describedby={err('message')}
                  className={`${inputCls} resize-y`}
                />
              </Field>

              {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
              <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                <label htmlFor="cf-website">Leave this field empty</label>
                <input
                  id="cf-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={fields.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </div>

              <div role="alert" className="m-0">
                {status === 'error' && (
                  <p className="m-0 text-[15px] font-medium text-[#a32d0a]">
                    {formError}{' '}
                    <a href={linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="btn btn-solid self-start disabled:cursor-wait disabled:opacity-70"
              >
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}

function Field(props: {
  id: string;
  label: React.ReactNode;
  error?: string;
  errId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-semibold">
        {props.label}
      </label>
      {props.children}
      {props.error && (
        <p id={props.errId} className="m-0 text-sm font-medium text-[#a32d0a]">
          {props.error}
        </p>
      )}
    </div>
  );
}
