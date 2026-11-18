import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  KV_REST_API_URL,
  KV_REST_API_TOKEN,
} from 'astro:env/server';

let redis: Redis | null | undefined;

/** Upstash via the Vercel Marketplace sets either the UPSTASH_* or the KV_* pair. */
export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = UPSTASH_REDIS_REST_URL || KV_REST_API_URL;
  const token = UPSTASH_REDIS_REST_TOKEN || KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Local dev without Redis is allowed. In production a missing limiter fails closed. */
export const limiterRequired = import.meta.env.PROD;

const cache = new Map<string, Ratelimit>();

export function limiter(
  name: string,
  requests: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${requests}:${window}`;
  let l = cache.get(key);
  if (!l) {
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `zia-portfolio:${name}`,
      analytics: false,
    });
    cache.set(key, l);
  }
  return l;
}

export type LimitOutcome = 'ok' | 'limited' | 'unavailable';

/** Checks every limiter in order; the first failure wins. `id` is the caller's IP, never logged. */
export async function check(
  checks: { name: string; requests: number; window: `${number} ${'s' | 'm' | 'h' | 'd'}` }[],
  id: string,
): Promise<LimitOutcome> {
  for (const c of checks) {
    const l = limiter(c.name, c.requests, c.window);
    if (!l) return limiterRequired ? 'unavailable' : 'ok';
    try {
      const res = await l.limit(id);
      if (!res.success) return 'limited';
    } catch {
      return limiterRequired ? 'unavailable' : 'ok';
    }
  }
  return 'ok';
}

/** Global daily request cap (all visitors), a backstop for spend. */
export async function underDailyCap(name: string, cap: number): Promise<LimitOutcome> {
  const r = getRedis();
  if (!r) return limiterRequired ? 'unavailable' : 'ok';
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `zia-portfolio:${name}:daily:${day}`;
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, 60 * 60 * 48);
    return n > cap ? 'limited' : 'ok';
  } catch {
    return limiterRequired ? 'unavailable' : 'ok';
  }
}

export function clientId(request: Request, fallback?: string): string {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || request.headers.get('x-real-ip') || fallback || 'unknown';
}
