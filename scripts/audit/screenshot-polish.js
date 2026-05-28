#!/usr/bin/env node
/**
 * Visual Polish Audit — screenshot pages at multiple viewport widths.
 *
 * Usage: node scripts/audit/screenshot-polish.js
 *
 * Output: .kiro/audits/raw/screens-polish/screen-<width>-<page>.png
 *         + screen-<width>-<page>-fold.png (above-the-fold only)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://frontend-seven-beta-46.vercel.app';
const PAGES = [
  { route: '/', slug: 'home' },
  { route: '/backtest', slug: 'backtest' },
  { route: '/challenge', slug: 'challenge' },
  { route: '/discipline', slug: 'discipline' },
  { route: '/proof-explorer', slug: 'proof-explorer' },
  { route: '/social', slug: 'social' },
];
const VIEWPORTS = [
  { w: 1440, h: 900, label: '1440' },
  { w: 1024, h: 768, label: '1024' },
  { w: 768,  h: 1024, label: '768' },
];

const OUT = path.resolve(__dirname, '../../.kiro/audits/raw/screens-polish');
fs.mkdirSync(OUT, { recursive: true });

async function shoot(browser, viewport, pageDef) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.w, height: viewport.h },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce', // freeze CSS animations for clean comparison
  });
  const page = await ctx.newPage();
  const url = BASE + pageDef.route;
  const startedAt = Date.now();

  let status = 'ok';
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    if (resp && !resp.ok()) status = `http_${resp.status()}`;
  } catch (e) {
    status = `nav_error:${e.message.slice(0,80)}`;
  }

  // Allow lazy content to settle a bit even with reduced motion
  await page.waitForTimeout(1500);

  const stem = `screen-${viewport.label}-${pageDef.slug}`;
  const fullPath = path.join(OUT, `${stem}.png`);
  const foldPath = path.join(OUT, `${stem}-fold.png`);

  try {
    await page.screenshot({ path: fullPath, fullPage: true });
    await page.screenshot({ path: foldPath, fullPage: false });
  } catch (e) {
    status = `${status};shot_error:${e.message.slice(0,60)}`;
  }

  const ms = Date.now() - startedAt;
  console.log(`[${viewport.label}] ${pageDef.route.padEnd(18)} ${status.padEnd(10)} ${ms}ms`);
  await ctx.close();
  return { url, viewport: viewport.label, page: pageDef.slug, status, fullPath, foldPath, ms };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const manifest = { base: BASE, captured_at: new Date().toISOString(), shots: [] };
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const r = await shoot(browser, vp, p);
      manifest.shots.push(r);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. Wrote ${manifest.shots.length} pairs to ${OUT}`);
})().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
