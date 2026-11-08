# Zia Hasheem, product marketing portfolio

Source for [zia.mba](https://zia.mba). Built with Claude Code: Astro, Tailwind and Vercel, with an AI assistant that answers questions about the work.

## Stack

- **Astro** (static output) with an MDX content collection for the six project cards, TypeScript, Tailwind v4 tokens, self-hosted fonts (Fontsource).
- **React islands** only for the chat and the contact dialog.
- **Vercel** via `@astrojs/vercel`. Only `/api/chat` and `/api/contact` run as functions (`prerender = false`, `maxDuration: 30`).

## Develop

```bash
npm install
cp .env.example .env   # fill in what you need; see below
npm run dev
npm test               # unit tests
npm run typecheck
npm run build          # also runs the TODO_ check
```

## Environment variables

Set these in **Vercel > Project > Settings > Environment Variables**. Nothing is committed. Names are in `.env.example`.

| Variable | Used by | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | chat | Also set a monthly spend limit in the Anthropic Console. |
| `CLAUDE_MODEL` | chat | Optional. Defaults to `claude-haiku-5-5`. |
| `CHAT_PRIVATE_RULES` | chat | Optional. Extra instructions appended to the system prompt at request time. Lives only in Vercel. |
| `CHAT_DAILY_LIMIT` | chat | Optional. Total chat requests per UTC day. Default 300. |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL` | contact | The destination address lives only here. |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | contact | Cloudflare Turnstile. The site key is public and inlined at **build** time, so set it before deploying. Add `zia.mba` (and `localhost` for dev) to the widget's hostnames in Cloudflare. |
| `RESEND_FROM` | contact | Optional verified sender. Defaults to Resend's test sender. |
| `UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/`_TOKEN` | both | Rate limits. Add Upstash Redis from the Vercel Marketplace. |

The contact form checks the Turnstile token server-side (after validation and the rate limit, before any email is sent) and rejects the request if it fails. With no `TURNSTILE_SECRET_KEY`, production refuses to send; local dev skips the check.

In production the endpoints **fail closed** (a friendly "unavailable" message) if the rate-limit store is not configured. Local dev runs without it.

## How the chat is grounded

The system prompt is built from only: the text on the page (`src/data/site.ts`), the six cards (`src/content/projects/`) and the approved fact sheet (`content/chat-facts.md`). The fact sheet's "Decisions" log is stripped before it reaches the model. To change what the assistant can say, edit those files. Nothing else feeds it.

`npm run eval:chat` runs 10 answer checks and 5 refusal/injection checks against a running server with a real API key.

## Rules for this repo (it is public)

- No keys, drafts, proprietary figures or private notes. `.env*`, `drafts/` and `metrics-from-project-files.md` are git-ignored.
- `npm run check:todo` fails production builds (`VERCEL_ENV=production`) if a `TODO_` placeholder is in shipped content.
- Regenerate the share image with `scripts/og/make-og.mjs` (needs Playwright).

## Domains

`zia.mba` is canonical. `ziahasheem.com` and the `www` variants redirect to it with a 308 (`vercel.json`), which also sets HSTS. Domains must be added to the Vercel project and DNS set up there.
