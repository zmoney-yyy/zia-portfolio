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

## Indexing switch (`SITE_INDEXABLE`)

The site is **not indexable by default**. One env var controls it: `SITE_INDEXABLE`. Anything other than the exact value `true` (including unset) means:

- `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">` and `<meta name="googlebot" content="noindex, nofollow">` in every page.
- An `X-Robots-Tag` header on every response (pages, static assets, `/api/*`, previews, `*.vercel.app`, including 404s), added to `.vercel/output/config.json` by `scripts/postbuild-indexing.mjs`. It is generated, not in `vercel.json`, because `vercel.json` cannot read env vars.
- `robots.txt` disallows named AI and training crawlers. It does not block `*`, so Google and Bing can fetch pages and see the noindex tag, and link-preview bots (LinkedIn, Slack, Facebook, X, iMessage) still read the share image.
- No sitemap and no `Sitemap:` line. The build fails if one slips through.

**To turn indexing back on:** set `SITE_INDEXABLE=true` in Vercel (Production scope), then redeploy. It is applied at build time, so a redeploy is required. Preview deployments stay noindex even with the switch on, and `*.vercel.app` URLs keep the header.

Already-indexed pages drop out only after search engines recrawl them. Do not add `Disallow: /` for `*`, because that stops them from seeing the noindex tag.

## How the chat is grounded

The system prompt is built from only: the text on the page (`src/data/site.ts`), the six cards (`src/content/projects/`) and the approved fact sheet (`content/chat-facts.md`). The fact sheet's "Decisions" log is stripped before it reaches the model. To change what the assistant can say, edit those files. Nothing else feeds it.

`npm run eval:chat` runs 10 answer checks and 5 refusal/injection checks against a running server with a real API key.

## Rules for this repo (it is public)

- No keys, drafts, proprietary figures or private notes. `.env*` and `drafts/` are git-ignored. Keep private notes and working files in `drafts/`.
- `npm run check:todo` fails production builds (`VERCEL_ENV=production`) if a `TODO_` placeholder is in shipped content.
- Regenerate the share image with `scripts/og/make-og.mjs` (needs Playwright).

## Domains

`zia.mba` is canonical. `ziahasheem.com` and the `www` variants redirect to it with a 308 (`vercel.json`), which also sets HSTS. Domains must be added to the Vercel project and DNS set up there.
