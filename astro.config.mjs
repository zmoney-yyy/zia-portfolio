import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// zia.mba is canonical. ziahasheem.com and the www variants redirect to it (see vercel.json).
export default defineConfig({
  site: 'https://zia.mba',
  output: 'static', // static by default; only /api/* routes opt out with `prerender = false`
  adapter: vercel({ maxDuration: 30 }), // explicit function timeout for /api/chat
  integrations: [react(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  // Server-only secrets. Read through `astro:env/server`; never exposed to the client.
  env: {
    schema: {
      ANTHROPIC_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CLAUDE_MODEL: envField.string({ context: 'server', access: 'public', optional: true }),
      // Optional extra instructions appended to the chat system prompt at request time.
      // Kept in Vercel env vars so they never enter the repo or the build output.
      CHAT_PRIVATE_RULES: envField.string({ context: 'server', access: 'secret', optional: true }),
      CHAT_DAILY_LIMIT: envField.number({ context: 'server', access: 'public', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Cloudflare Turnstile. The site key is public by design (it is rendered in the page);
      // the secret key is server-only and used by /api/contact to verify tokens.
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      UPSTASH_REDIS_REST_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      UPSTASH_REDIS_REST_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      KV_REST_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      KV_REST_API_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
