import { SITE_INDEXABLE } from 'astro:env/server';
import { ROBOTS_VALUE, isIndexable } from './indexing.mjs';

/** Response headers for the API routes: X-Robots-Tag while indexing is off, nothing otherwise. */
export function robotsHeaders(): Record<string, string> {
  return isIndexable({ siteIndexable: SITE_INDEXABLE, vercelEnv: process.env.VERCEL_ENV })
    ? {}
    : { 'X-Robots-Tag': ROBOTS_VALUE };
}
