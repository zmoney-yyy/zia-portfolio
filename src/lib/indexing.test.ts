import { describe, expect, it } from 'vitest';
import {
  AI_CRAWLERS,
  GOOGLEBOT_VALUE,
  ROBOTS_VALUE,
  isIndexable,
  robotsHeaderRoute,
  robotsTxt,
  withRobotsHeaderRoute,
} from './indexing.mjs';

describe('isIndexable (the one switch)', () => {
  it('defaults to not indexable', () => {
    expect(isIndexable({})).toBe(false);
    expect(isIndexable()).toBe(false);
  });
  it('is on only for the exact string "true"', () => {
    expect(isIndexable({ siteIndexable: 'true' })).toBe(true);
    for (const v of ['false', 'TRUE', 'True', '1', 'yes', ' true', '']) {
      expect(isIndexable({ siteIndexable: v })).toBe(false);
    }
  });
  it('never indexes preview or development deployments, even with the switch on', () => {
    expect(isIndexable({ siteIndexable: 'true', vercelEnv: 'production' })).toBe(true);
    expect(isIndexable({ siteIndexable: 'true', vercelEnv: 'preview' })).toBe(false);
    expect(isIndexable({ siteIndexable: 'true', vercelEnv: 'development' })).toBe(false);
  });
});

describe('robots values', () => {
  it('match the requested strings', () => {
    expect(ROBOTS_VALUE).toBe('noindex, nofollow, noarchive, nosnippet, noimageindex');
    expect(GOOGLEBOT_VALUE).toBe('noindex, nofollow');
  });
});

describe('robotsTxt while indexing is off', () => {
  const txt = robotsTxt({ indexable: false, siteUrl: 'https://zia.mba' });
  it('disallows every listed AI crawler by name', () => {
    expect(AI_CRAWLERS).toHaveLength(17);
    for (const a of AI_CRAWLERS) expect(txt).toContain(`User-agent: ${a}\n`);
  });
  it('does not disallow "*", so search engines can read the noindex tag', () => {
    expect(txt).toMatch(/User-agent: \*\nAllow: \/\n/);
    const star = txt.slice(txt.indexOf('User-agent: *'));
    expect(star).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
  it('does not block social link-preview bots or search engines by name', () => {
    for (const b of ['LinkedInBot', 'Slackbot', 'facebookexternalhit', 'Twitterbot', 'Googlebot', 'Bingbot', 'bingbot', 'Applebot\n'])
      expect(txt).not.toContain(`User-agent: ${b}`);
  });
  it('has no Sitemap line', () => {
    expect(/^Sitemap:/im.test(txt)).toBe(false);
  });
});

describe('robotsTxt when indexing is on', () => {
  it('is the open file with a sitemap', () => {
    const txt = robotsTxt({ indexable: true, siteUrl: 'https://zia.mba' });
    expect(txt).toContain('Sitemap: https://zia.mba/sitemap-index.xml');
    expect(txt).not.toContain('GPTBot');
  });
});

describe('header route', () => {
  it('matches every path and host while indexing is off', () => {
    const r = robotsHeaderRoute(false);
    expect(r).toEqual({ src: '/(.*)', headers: { 'X-Robots-Tag': ROBOTS_VALUE }, continue: true });
  });
  it('is limited to *.vercel.app hosts while indexing is on', () => {
    const r = robotsHeaderRoute(true) as { has: { type: string; value: string }[] };
    expect(r.has).toEqual([{ type: 'host', value: '(.*)\\.vercel\\.app' }]);
    expect(new RegExp(r.has[0].value).test('zia-portfolio-git-x.vercel.app')).toBe(true);
    expect(new RegExp(`^${r.has[0].value}$`).test('zia.mba')).toBe(false);
  });
  it('is placed first, before the filesystem handler, and is idempotent', () => {
    const cfg = { version: 3, routes: [{ src: '/a', headers: { x: '1' }, continue: true }, { handle: 'filesystem' }] };
    const once = withRobotsHeaderRoute(cfg, false);
    expect(once.routes[0]).toEqual(robotsHeaderRoute(false));
    expect(once.routes).toHaveLength(3);
    expect(withRobotsHeaderRoute(once, false).routes).toHaveLength(3);
    expect(withRobotsHeaderRoute(once, true).routes[0]).toEqual(robotsHeaderRoute(true));
    expect(cfg.routes).toHaveLength(2); // input untouched
  });
});
