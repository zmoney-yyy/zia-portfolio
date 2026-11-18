// Runs after `astro build`. Applies the SITE_INDEXABLE switch to the Vercel build output:
//   - adds the X-Robots-Tag route to .vercel/output/config.json (all paths, incl. static assets
//     and /api/*, on production, preview and *.vercel.app)
//   - checks that the output matches the switch, and fails the build if it doesn't
// vercel.json is static JSON and cannot read env vars, so the header lives here instead.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isIndexable, withRobotsHeaderRoute } from '../src/lib/indexing.mjs';

const indexable = isIndexable({
  siteIndexable: process.env.SITE_INDEXABLE,
  vercelEnv: process.env.VERCEL_ENV,
});
const OUT = '.vercel/output';
const fail = (msg) => {
  console.error(`postbuild-indexing: ERROR: ${msg}`);
  process.exit(1);
};

if (!existsSync(`${OUT}/config.json`)) fail(`${OUT}/config.json not found (did astro build run?)`);
const config = JSON.parse(readFileSync(`${OUT}/config.json`, 'utf8'));
writeFileSync(`${OUT}/config.json`, JSON.stringify(withRobotsHeaderRoute(config, indexable), null, 2) + '\n');

const staticDir = `${OUT}/static`;
const robots = readFileSync(`${staticDir}/robots.txt`, 'utf8');
const sitemaps = readdirSync(staticDir).filter((f) => /^sitemap.*\.xml$/.test(f));
const html = readFileSync(`${staticDir}/index.html`, 'utf8');
const hasNoindexMeta = /<meta name="robots" content="[^"]*noindex/.test(html);

if (!indexable) {
  if (sitemaps.length) fail(`sitemap files present while indexing is off: ${sitemaps.join(', ')}`);
  if (/^\s*Sitemap:/im.test(robots) || /rel="sitemap"/i.test(html)) fail('a sitemap reference is present while indexing is off');
  if (!hasNoindexMeta) fail('noindex meta tag missing from index.html while indexing is off');
  // "User-agent: *" must never be followed by "Disallow: /" (search engines must see the noindex tag).
  if (/User-agent:\s*\*\s*\n(?:\s*#.*\n)*\s*Disallow:\s*\/\s*$/im.test(robots)) fail('robots.txt blocks all crawlers');
}
console.log(
  `postbuild-indexing: indexable=${indexable} (SITE_INDEXABLE=${process.env.SITE_INDEXABLE ?? '(unset)'}, VERCEL_ENV=${process.env.VERCEL_ENV ?? '(unset)'}); ` +
    `header route ${indexable ? 'limited to *.vercel.app' : 'applied to all paths'}; sitemap files: ${sitemaps.length}`,
);
