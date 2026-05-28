#!/usr/bin/env node
/**
 * Local verification of Audit R14 fixes.
 *
 * Hits a locally running Next.js server (npm run start -- -p 3210)
 * at multiple viewports, captures fold + full screenshots, and
 * extracts the same DOM measurements that fed the original audit
 * (container widths, H2 X positions, gaps, paddings, emoji counts,
 * z-index inventory). Writes the results next to the audit raw
 * folder so before/after deltas are obvious.
 *
 * Usage: node scripts/audit/verify-polish.js
 *
 * Output:
 *   .kiro/audits/raw/screens-polish-after/screen-<vp>-<page>{,-fold}.png
 *   .kiro/audits/raw/screens-polish-after/_measurements-after.json
 *   .kiro/audits/raw/screens-polish-after/_delta.md
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AUDIT_BASE || 'http://localhost:3210';
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
  { w: 768, h: 1024, label: '768' },
];

const OUT = path.resolve(__dirname, '../../.kiro/audits/raw/screens-polish-after');
fs.mkdirSync(OUT, { recursive: true });

async function measure(browser, viewport, pageDef) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.w, height: viewport.h },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const url = BASE + pageDef.route;

  let status = 'ok';
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (resp && !resp.ok()) status = `http_${resp.status()}`;
  } catch (e) {
    status = `nav_error:${e.message.slice(0, 80)}`;
  }
  await page.waitForTimeout(1200);

  const stem = `screen-${viewport.label}-${pageDef.slug}`;
  try {
    await page.screenshot({ path: path.join(OUT, `${stem}.png`), fullPage: true });
    await page.screenshot({ path: path.join(OUT, `${stem}-fold.png`), fullPage: false });
  } catch (e) {
    status = `${status};shot_error:${e.message.slice(0, 60)}`;
  }

  const data = await page.evaluate(() => {
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    function trunc(s, n = 80) { return (s || '').replace(/\s+/g, ' ').trim().slice(0, n); }
    function cs(el) { return getComputedStyle(el); }

    const out = {
      headings: [],
      contentWidths: { mainBox: null, largestCard: null },
      gaps: new Set(),
      paddings: new Set(),
      icons: { svg: 0, emoji: 0, emojiList: [] },
      zIndex: new Set(),
    };

    // headings
    document.querySelectorAll('h1, h2, h3').forEach((h) => {
      const r = rect(h);
      if (!r.w) return;
      out.headings.push({ tag: h.tagName.toLowerCase(), text: trunc(h.textContent), x: r.x, y: r.y, w: r.w });
    });

    // largest content card per page (heuristic)
    let main = document.querySelector('main');
    if (main) out.contentWidths.mainBox = rect(main).w;

    let max = 0;
    document.querySelectorAll('.glass-card, .glass-hero, [class*="rounded-"]').forEach((el) => {
      const r = rect(el);
      if (r.w > max && r.w < 1500) {
        max = r.w;
      }
    });
    out.contentWidths.largestCard = max;

    // gaps (only on flex/grid wide containers)
    document.querySelectorAll('*').forEach((el) => {
      const s = cs(el);
      if ((s.display === 'flex' || s.display === 'grid') && parseFloat(s.gap) > 0) {
        const r = rect(el);
        if (r.w > 200) out.gaps.add(s.gap);
      }
    });

    // padding inventory (cards only)
    document.querySelectorAll('.glass-card, .glass-hero, .stat-card').forEach((el) => {
      const s = cs(el);
      out.paddings.add(`${parseFloat(s.paddingTop)}/${parseFloat(s.paddingRight)}/${parseFloat(s.paddingBottom)}/${parseFloat(s.paddingLeft)}`);
    });

    // svg vs emoji
    out.icons.svg = document.querySelectorAll('svg').length;
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    function walk(node, depth = 0) {
      if (depth > 12) return;
      if (node.nodeType === 3) {
        if (emojiRe.test(node.nodeValue || '')) {
          out.icons.emoji += 1;
          if (out.icons.emojiList.length < 20) {
            out.icons.emojiList.push(node.nodeValue.trim().slice(0, 40));
          }
        }
      } else if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
        for (const c of node.childNodes) walk(c, depth + 1);
      }
    }
    walk(document.body);

    // z-index
    document.querySelectorAll('*').forEach((el) => {
      const z = cs(el).zIndex;
      if (z && z !== 'auto' && z !== '0') out.zIndex.add(z);
    });

    out.gaps = [...out.gaps];
    out.paddings = [...out.paddings];
    out.zIndex = [...out.zIndex];
    return out;
  });

  await ctx.close();
  return { url, viewport: viewport.label, page: pageDef.slug, status, data };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const all = { base: BASE, captured_at: new Date().toISOString(), measurements: [] };
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const m = await measure(browser, vp, p);
      console.log(`[${vp.label}] ${p.route.padEnd(18)} ${m.status}  mainBox=${m.data.contentWidths.mainBox} card=${m.data.contentWidths.largestCard} gaps=${m.data.gaps.length} pads=${m.data.paddings.length} emoji=${m.data.icons.emoji}`);
      all.measurements.push(m);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, '_measurements-after.json'), JSON.stringify(all, null, 2));

  // Generate delta vs original
  const beforePath = path.resolve(__dirname, '../../.kiro/audits/raw/screens-polish/_measurements.json');
  if (fs.existsSync(beforePath)) {
    const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));

    const lines = [];
    lines.push('# Audit R14 — Verification Delta\n');
    lines.push(`Captured: ${all.captured_at}`);
    lines.push(`Base: ${BASE}\n`);

    function findBefore(vp, slug) {
      return before.measurements.find((m) => m.viewport === vp && m.page === slug);
    }

    lines.push('## Container width consistency (largest card per page) @ 1440\n');
    lines.push('| Page | Before | After | Δ |');
    lines.push('|---|---|---|---|');
    for (const p of PAGES) {
      const a = all.measurements.find((m) => m.viewport === '1440' && m.page === p.slug);
      const b = findBefore('1440', p.slug);
      if (!a || !b) continue;
      // before files used data.cards; we don't have that here, so use bordersByRadius isn't useful.
      // Just report after for honesty if before measurements lack the same field.
      const beforeMain = b.data && b.data.cards
        ? b.data.cards.reduce((m, c) => Math.max(m, c.rect.w < 1500 ? c.rect.w : 0), 0)
        : null;
      const after = a.data.contentWidths.largestCard;
      const delta = beforeMain ? `${after - beforeMain}px` : 'n/a';
      lines.push(`| ${p.slug} | ${beforeMain ?? '—'} | ${after} | ${delta} |`);
    }

    lines.push('\n## H2 axis (proof-explorer @ 1440)\n');
    const a = all.measurements.find((m) => m.viewport === '1440' && m.page === 'proof-explorer');
    if (a) {
      const xs = a.data.headings.filter((h) => h.tag === 'h2').map((h) => h.x);
      const unique = [...new Set(xs)].sort((x, y) => x - y);
      const spread = unique.length > 1 ? unique[unique.length - 1] - unique[0] : 0;
      lines.push(`After: H2 X positions = [${unique.join(', ')}] · spread = ${spread}px`);
      lines.push('Audit reported: positions [104, 129, 136, 144] · spread = 40px before fix');
    }

    lines.push('\n## Gap scale on `/` @ 1440\n');
    const aHome = all.measurements.find((m) => m.viewport === '1440' && m.page === 'home');
    if (aHome) {
      lines.push(`After: ${aHome.data.gaps.length} distinct gap values: ${aHome.data.gaps.sort((x, y) => parseFloat(x) - parseFloat(y)).join(', ')}`);
      lines.push('Audit reported: 9 distinct gap values before fix');
    }

    lines.push('\n## Card-padding signatures @ 1440\n');
    lines.push('| Page | Before count | After count | After signatures |');
    lines.push('|---|---|---|---|');
    for (const p of ['home', 'proof-explorer', 'backtest']) {
      const after = all.measurements.find((m) => m.viewport === '1440' && m.page === p);
      const beforeM = findBefore('1440', p);
      const beforeCount = beforeM && beforeM.data && beforeM.data.paddings
        ? new Set(beforeM.data.paddings.map((x) => x.pad)).size
        : null;
      lines.push(`| ${p} | ${beforeCount ?? '—'} | ${after.data.paddings.length} | \`${after.data.paddings.join(' | ')}\` |`);
    }

    lines.push('\n## Emoji glyph count\n');
    lines.push('| Page | Before | After | After list |');
    lines.push('|---|---|---|---|');
    for (const p of PAGES) {
      const a2 = all.measurements.find((m) => m.viewport === '1440' && m.page === p.slug);
      const b2 = findBefore('1440', p.slug);
      if (!a2) continue;
      const beforeCount = b2 && b2.data && b2.data.icons
        ? b2.data.icons.filter((i) => i.tag === 'emoji').length
        : null;
      lines.push(`| ${p.slug} | ${beforeCount ?? '—'} | ${a2.data.icons.emoji} | \`${a2.data.icons.emojiList.join(' | ')}\` |`);
    }

    lines.push('\n## z-index inventory\n');
    const aHomeZ = all.measurements.find((m) => m.viewport === '1440' && m.page === 'home');
    if (aHomeZ) {
      lines.push(`After (homepage): [${aHomeZ.data.zIndex.sort((x, y) => parseInt(x, 10) - parseInt(y, 10)).join(', ')}]`);
    }

    fs.writeFileSync(path.join(OUT, '_delta.md'), lines.join('\n'));
    console.log(`\nWrote ${OUT}/_delta.md`);
  }

  console.log(`\nWrote _measurements-after.json (${all.measurements.length} entries)`);
})().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
