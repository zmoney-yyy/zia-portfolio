import type { APIRoute } from 'astro';
import { SITE_INDEXABLE } from 'astro:env/server';
import { site } from '../data/site';
import { isIndexable, robotsTxt } from '../lib/indexing.mjs';

// Prerendered at build time from the SITE_INDEXABLE switch.
export const GET: APIRoute = () =>
  new Response(
    robotsTxt({
      indexable: isIndexable({ siteIndexable: SITE_INDEXABLE, vercelEnv: process.env.VERCEL_ENV }),
      siteUrl: site.url,
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
