// Fails the build if a TODO_ placeholder is left in anything that ships.
// Strict on Vercel production builds (or with STRICT_TODO_CHECK=1); a warning elsewhere,
// so preview branches can still build while content is in progress.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'content', 'public'];
const TEXT = new Set(['.md', '.mdx', '.ts', '.tsx', '.astro', '.json', '.css', '.svg', '.txt', '.html', '.mjs']);
const NEEDLE = 'TODO' + '_'; // built from parts so this script never matches itself

const hits = [];
const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (TEXT.has(extname(p)) && !/\.test\.[tj]sx?$/.test(p)) {  // tests are not shipped
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => line.includes(NEEDLE) && hits.push(`${p}:${i + 1}: ${line.trim()}`));
    }
  }
};
ROOTS.forEach(walk);

const strict = process.env.VERCEL_ENV === 'production' || process.env.STRICT_TODO_CHECK === '1';
if (hits.length) {
  console.error(`${strict ? 'ERROR' : 'WARNING'}: ${hits.length} ${NEEDLE} placeholder(s) in shipped content:`);
  hits.forEach((h) => console.error('  ' + h));
  if (strict) process.exit(1);
} else {
  console.log(`check-todo: no ${NEEDLE} placeholders found.`);
}
