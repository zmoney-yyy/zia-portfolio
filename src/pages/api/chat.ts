import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { getCollection } from 'astro:content';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, CHAT_DAILY_LIMIT, CHAT_PRIVATE_RULES } from 'astro:env/server';
import facts from '../../../content/chat-facts.md?raw';
import { CHAT, DEFAULT_DAILY_CHAT_LIMIT, DEFAULT_MODEL } from '../../lib/config';
import { buildSystemPrompt, withPrivateRules } from '../../lib/chat-prompt';
import { validateChat } from '../../lib/validate';
import { check, clientId, underDailyCap } from '../../lib/ratelimit';
import { about, hero, howIWork, proof } from '../../data/site';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Built once per server instance from the page text, the six cards and the approved fact sheet.
let systemPrompt: Promise<string> | undefined;
function getSystemPrompt() {
  systemPrompt ??= getCollection('projects').then((entries) =>
    buildSystemPrompt({
      site: { hero, proof, howIWork, about },
      projects: entries.sort((a, b) => a.data.order - b.data.order).map((e) => e.data),
      facts,
    }),
  );
  return systemPrompt;
}

const REFUSED =
  "I can't help with that one, but I'm happy to answer questions about Zia's work. Or use the Contact form to reach him directly.";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: 'Unsupported request.' }, 415);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Unsupported request.' }, 400);
  }
  const parsed = validateChat(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  if (!ANTHROPIC_API_KEY) return json({ error: 'unavailable' }, 503);

  const gate = await check(
    [
      { name: 'chat', requests: CHAT.perIp.requests, window: CHAT.perIp.window },
      { name: 'chat-day', requests: CHAT.perIpDaily.requests, window: CHAT.perIpDaily.window },
    ],
    clientId(request, clientAddress),
  );
  if (gate === 'limited') return json({ error: 'rate_limited' }, 429);
  if (gate === 'unavailable') return json({ error: 'unavailable' }, 503);

  const cap = await underDailyCap('chat', CHAT_DAILY_LIMIT ?? DEFAULT_DAILY_CHAT_LIMIT);
  if (cap !== 'ok') return json({ error: cap === 'limited' ? 'daily_cap' : 'unavailable' }, 503);

  // Questions are logged (no IPs, truncated) so Zia can see what recruiters ask.
  const question = parsed.messages[parsed.messages.length - 1].content;
  console.log(JSON.stringify({ type: 'chat_question', q: question.slice(0, 300) }));

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const stream = client.messages.stream({
    model: CLAUDE_MODEL || DEFAULT_MODEL,
    max_tokens: CHAT.maxOutputTokens,
    output_config: { effort: 'low' },
    // The base prompt is built once; CHAT_PRIVATE_RULES is read per request and appended.
    system: withPrivateRules(await getSystemPrompt(), CHAT_PRIVATE_RULES),
    messages: parsed.messages,
  });

  async function* text() {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      } else if (event.type === 'message_delta' && event.delta.stop_reason === 'refusal') {
        yield REFUSED;
      }
    }
  }

  // Pull the first chunk before replying, so auth/quota/API errors become a proper status
  // code instead of a half-open stream.
  const it = text();
  let first: IteratorResult<string>;
  try {
    first = await it.next();
  } catch (err) {
    console.error('chat: upstream error', err instanceof Anthropic.APIError ? err.status : 'unknown');
    return json({ error: 'unavailable' }, 503);
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        if (!first.done) {
          for await (const chunk of it) controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const ALL: APIRoute = () => json({ error: 'Method not allowed.' }, 405);
