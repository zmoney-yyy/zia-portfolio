// One switch for search-engine and AI-crawler indexing: the SITE_INDEXABLE env var.
// Anything other than the exact string "true" means "do not index". Plain .mjs so the Astro
// config, the post-build script, pages and endpoints can all import it.

export const ROBOTS_VALUE = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
export const GOOGLEBOT_VALUE = 'noindex, nofollow';

// AI and training crawlers blocked by name in robots.txt while indexing is off.
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'cohere-ai',
  'Diffbot',
];

/**
 * @param {{ siteIndexable?: string, vercelEnv?: string }} input
 * @returns {boolean} true only when the switch is exactly "true" AND this is not a Vercel
 * preview or development deployment (those are never indexable, whatever the switch says).
 */
export function isIndexable({ siteIndexable, vercelEnv } = {}) {
  if (siteIndexable !== 'true') return false;
  if (vercelEnv && vercelEnv !== 'production') return false;
  return true;
}

/**
 * robots.txt. While indexing is off there is deliberately NO "Disallow: /" for "*": Googlebot
 * and Bingbot must be able to fetch pages to see the noindex tag, and link-preview bots
 * (LinkedInBot, Slackbot, facebookexternalhit, Twitterbot, iMessage) must still read the
 * Open Graph tags. Only the named AI and training crawlers are disallowed, and there is no
 * Sitemap line.
 * @param {{ indexable: boolean, siteUrl: string }} input
 */
export function robotsTxt({ indexable, siteUrl }) {
  if (indexable) {
    return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap-index.xml\n`;
  }
  const agents = AI_CRAWLERS.map((a) => `User-agent: ${a}`).join('\n');
  return [
    '# Indexing is switched off (SITE_INDEXABLE is not "true").',
    '# Search engines are NOT disallowed here on purpose: they must fetch pages to see the',
    '# noindex tag. Link-preview bots are not blocked, so shared links keep their image.',
    '',
    agents,
    'Disallow: /',
    '',
    'User-agent: *',
    'Allow: /',
    '',
  ].join('\n');
}

/**
 * The Vercel Build Output route that adds X-Robots-Tag to every response (pages, static
 * assets, /api/*, previews). While indexing is off it matches all hosts. If indexing is on,
 * it still marks *.vercel.app hosts (the deployment URLs) as noindex.
 * @param {boolean} indexable
 */
export function robotsHeaderRoute(indexable) {
  return {
    src: '/(.*)',
    headers: { 'X-Robots-Tag': ROBOTS_VALUE },
    ...(indexable ? { has: [{ type: 'host', value: '(.*)\\.vercel\\.app' }] } : {}),
    continue: true,
  };
}

/**
 * Returns a copy of a Build Output config.json with the robots header route placed first, so it
 * runs before the filesystem handler. Safe to run twice.
 * @param {{ routes?: any[] }} config
 * @param {boolean} indexable
 */
export function withRobotsHeaderRoute(config, indexable) {
  const isOurs = (r) => r && r.headers && 'X-Robots-Tag' in r.headers && !r.handle;
  const rest = (config.routes ?? []).filter((r) => !isOurs(r));
  return { ...config, routes: [robotsHeaderRoute(indexable), ...rest] };
}
