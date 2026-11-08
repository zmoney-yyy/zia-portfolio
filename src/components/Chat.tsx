import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string; failed?: boolean };

type Props = {
  label: string;
  placeholder: string;
  suggestions: string[];
  linkedin: string;
  maxChars?: number;
};

const MESSAGES: Record<string, string> = {
  rate_limited: "That's a lot of questions in a short time. Please try again in a few minutes.",
  default: "The assistant isn't available right now.",
};

export default function Chat({ label, placeholder, suggestions, linkedin, maxChars = 500 }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    const history: Msg[] = [...messages.filter((m) => !m.failed), { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    const ctrl = new AbortController();
    abort.current = ctrl;
    const fail = (text: string) =>
      setMessages([...history, { role: 'assistant', content: text, failed: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        let code = 'default';
        let message = '';
        try {
          const data = await res.json();
          code = data.error ?? 'default';
          if (res.status === 400 || res.status === 413) message = data.error;
        } catch {
          /* ignore */
        }
        fail(message || MESSAGES[code] || MESSAGES.default);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: answer }]);
      }
      answer += decoder.decode();
      if (!answer.trim()) fail(MESSAGES.default);
      else setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') fail(MESSAGES.default);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: SyntheticEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="on-dark box-border min-w-0 rounded-[18px] border border-[#34343c] bg-night-2 p-6">
      <p className="mb-3.5 text-[13px] font-semibold text-night-muted">{label}</p>

      {messages.length === 0 && (
        <ul className="m-0 mb-5 flex list-none flex-wrap gap-2.5 p-0" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => void ask(s)}
                disabled={busy}
                className="min-h-11 cursor-pointer rounded-full border border-night-line bg-night-3 px-4 py-2.5 text-left text-[15px] font-medium text-cream hover:bg-[#34343c]"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {messages.length > 0 && (
        <div
          className="mb-5 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1"
          role="log"
          aria-live="polite"
          aria-busy={busy}
          aria-label="Conversation"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'self-end rounded-2xl rounded-br-md bg-night-3 px-4 py-2.5 text-[15px] text-cream'
                  : 'self-start whitespace-pre-wrap text-[15px] leading-relaxed text-night-text'
              }
            >
              {m.role === 'assistant' && !m.content && busy ? (
                <span className="text-night-muted">Thinking…</span>
              ) : (
                m.content
              )}
              {m.failed && (
                <span className="mt-2 block">
                  <button
                    type="button"
                    data-open-contact
                    className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-sun underline"
                  >
                    Contact Zia
                  </button>{' '}
                  or{' '}
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold !text-sun underline"
                  >
                    find him on LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2.5">
        <label htmlFor="ask-input" className="sr-only">
          Ask a question about Zia's work
        </label>
        <input
          id="ask-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={maxChars}
          placeholder={placeholder}
          autoComplete="off"
          className="ask-input box-border min-h-12 min-w-0 flex-[1_1_240px] rounded-xl border border-night-line bg-night px-4 py-3.5 text-base text-cream"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-12 cursor-pointer rounded-xl border-0 bg-sun px-6 text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
