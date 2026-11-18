// Regenerates public/og.png (Option A share card). Needs Playwright, which is not a project
// dependency:  npx --package playwright node scripts/og/make-og.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'og.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, '../../public/og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('wrote public/og.png');
