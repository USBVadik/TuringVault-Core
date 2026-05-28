#!/usr/bin/env node
/**
 * Visual Polish Audit — measure DOM-level polish dimensions.
 *
 * For each (viewport × page) it extracts machine-checked numbers
 * that the audit report can cite as evidence:
 *
 *  - section heading bounding boxes (left edge + width) -> asymmetry
 *  - card containers: padding, margin, border-radius, background-color
 *  - button heights in the same row
 *  - icon sizes (img/svg) within close groups
 *  - colors used for "live"/"success" badges
 *  - emoji vs lucide-svg coexistence
 *  - empty-state strings ("—", "N/A", "n/a", "null", "loading")
 *  - z-index inventory (any element with z-index set)
 *
 * Output: .kiro/audits/raw/screens-polish/_measurements.json
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

async function measure(browser, viewport, pageDef) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.w, height: viewport.h },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const url = BASE + pageDef.route;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.error(`nav fail ${pageDef.slug}@${viewport.label}: ${e.message}`);
    await ctx.close();
    return { url, viewport: viewport.label, page: pageDef.slug, error: e.message };
  }
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const out = {
      headings: [],         // h1, h2, h3 with rect + computed
      cards: [],            // common card-like elements
      buttons: [],          // buttons + role="button"
      icons: [],            // svg + img + emoji
      badges: [],           // small chips with bright bg
      emptyStates: [],      // text matches
      zIndex: [],           // any element with z-index !== auto/0
      colors: { greens: new Set(), reds: new Set(), accents: new Set() },
      fonts: new Set(),
      bordersByRadius: {},  // radius -> count
      gaps: [],             // computed gap on flex/grid containers
      paddings: [],         // padding on card-like containers
    };

    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    function trunc(s, n=80) { return (s || '').replace(/\s+/g,' ').trim().slice(0,n); }
    function cs(el) { return getComputedStyle(el); }

    // --- headings ---
    document.querySelectorAll('h1,h2,h3').forEach((h) => {
      const r = rect(h);
      if (r.w === 0 || r.h === 0) return;
      const s = cs(h);
      out.headings.push({
        tag: h.tagName.toLowerCase(),
        text: trunc(h.textContent),
        rect: r,
        fontSize: parseFloat(s.fontSize),
        fontWeight: parseInt(s.fontWeight, 10),
        color: s.color,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
      });
    });

    // --- card-like containers (anything with rounded corners and a background) ---
    const cardSelectors = [
      '.glass-card', '.glass-hero', '.stat-card', '.stat-card-interactive',
      '[class*="rounded-"]', '[class*="card"]'
    ];
    const cardSet = new Set();
    cardSelectors.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(e => cardSet.add(e)); } catch(e){}
    });
    Array.from(cardSet).forEach((el) => {
      const r = rect(el);
      if (r.w < 40 || r.h < 20) return;
      const s = cs(el);
      const radius = s.borderTopLeftRadius;
      const padTop = parseFloat(s.paddingTop);
      const padRight = parseFloat(s.paddingRight);
      const padBottom = parseFloat(s.paddingBottom);
      const padLeft = parseFloat(s.paddingLeft);
      const bg = s.backgroundColor;
      const border = s.borderTopColor + ' ' + s.borderTopWidth;
      const cls = (el.className || '').toString().slice(0, 90);
      out.cards.push({ cls, rect: r, radius, padding: [padTop, padRight, padBottom, padLeft], bg, border });
      out.bordersByRadius[radius] = (out.bordersByRadius[radius] || 0) + 1;
      if (padTop || padLeft) out.paddings.push({ cls: cls.slice(0, 50), pad: `${padTop}/${padRight}/${padBottom}/${padLeft}` });
    });

    // --- buttons ---
    document.querySelectorAll('button, [role="button"], a.btn-primary, a.btn-ghost').forEach((b) => {
      const r = rect(b);
      if (r.w === 0) return;
      const s = cs(b);
      out.buttons.push({
        text: trunc(b.textContent, 40),
        rect: r,
        radius: s.borderTopLeftRadius,
        padY: parseFloat(s.paddingTop) + parseFloat(s.paddingBottom),
        padX: parseFloat(s.paddingLeft) + parseFloat(s.paddingRight),
        bg: s.backgroundColor,
        cls: (b.className || '').toString().slice(0, 80),
      });
    });

    // --- icons ---
    document.querySelectorAll('svg, img').forEach((i) => {
      const r = rect(i);
      if (r.w === 0) return;
      out.icons.push({
        tag: i.tagName.toLowerCase(),
        rect: r,
        ariaLabel: i.getAttribute('aria-label') || i.getAttribute('alt') || '',
        cls: (i.getAttribute('class') || '').slice(0, 60),
      });
    });

    // --- emoji presence (basic) ---
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    function walk(node, depth=0) {
      if (depth > 12) return;
      if (node.nodeType === 3) {
        if (emojiRe.test(node.nodeValue || '')) {
          const p = node.parentElement;
          if (p) {
            const r = rect(p);
            out.icons.push({
              tag: 'emoji',
              text: trunc(node.nodeValue, 8),
              rect: r,
              cls: (p.className || '').toString().slice(0, 60),
            });
          }
        }
      } else if (node.nodeType === 1 && !['SCRIPT','STYLE','NOSCRIPT'].includes(node.tagName)) {
        for (const c of node.childNodes) walk(c, depth+1);
      }
    }
    walk(document.body);

    // --- badges (look for small elements with green/amber/red bg) ---
    document.querySelectorAll('span, div').forEach((el) => {
      const s = cs(el);
      const bg = s.backgroundColor;
      const m = bg.match(/^rgba?\(([^)]+)\)/);
      if (!m) return;
      const parts = m[1].split(',').map(x => parseFloat(x.trim()));
      const [r, g, bl, a=1] = parts;
      if (a < 0.05) return;
      const small = el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 30;
      if (!small) return;
      const rec = rect(el);
      if (rec.w > 250 || rec.h > 60) return;
      // green-ish
      if (g > 150 && r < 200 && bl < 200) {
        out.colors.greens.add(bg);
        if (out.badges.length < 80) out.badges.push({ kind: 'green', bg, text: trunc(el.textContent, 30), rect: rec });
      } else if (r > 180 && g < 120 && bl < 150) {
        out.colors.reds.add(bg);
        if (out.badges.length < 80) out.badges.push({ kind: 'red', bg, text: trunc(el.textContent, 30), rect: rec });
      } else if ((r > 120 || bl > 120) && a > 0.1) {
        out.colors.accents.add(bg);
      }
    });

    // --- empty states ---
    const emptyTexts = ['—', '–', 'N/A', 'n/a', 'null', 'loading…', 'loading...', '...', 'no data', 'No data'];
    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length > 0) return;
      const t = (el.textContent || '').trim();
      if (!t || t.length > 30) return;
      if (emptyTexts.some(et => t === et || t.toLowerCase() === et.toLowerCase())) {
        const r = rect(el);
        if (r.w === 0) return;
        out.emptyStates.push({ text: t, rect: r, cls: (el.className||'').toString().slice(0,60) });
      }
    });

    // --- z-index inventory ---
    document.querySelectorAll('*').forEach((el) => {
      const z = cs(el).zIndex;
      if (z && z !== 'auto' && z !== '0') {
        const r = rect(el);
        if (r.w === 0) return;
        out.zIndex.push({ z, tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,50), rect: r });
      }
    });

    // --- gaps on flex/grid containers ---
    document.querySelectorAll('*').forEach((el) => {
      const s = cs(el);
      if ((s.display === 'flex' || s.display === 'inline-flex' || s.display === 'grid') && (parseFloat(s.gap) > 0 || parseFloat(s.rowGap) > 0)) {
        const r = rect(el);
        if (r.w < 200) return;
        out.gaps.push({
          display: s.display,
          gap: s.gap,
          row: s.rowGap,
          col: s.columnGap,
          flexDir: s.flexDirection,
          cls: (el.className || '').toString().slice(0, 60),
          rect: r,
        });
      }
    });

    // serialise sets
    out.colors.greens = [...out.colors.greens];
    out.colors.reds = [...out.colors.reds];
    out.colors.accents = [...out.colors.accents].slice(0, 30);
    out.fonts = [...out.fonts];
    return out;
  });

  await ctx.close();
  return { url, viewport: viewport.label, page: pageDef.slug, data };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const all = { base: BASE, captured_at: new Date().toISOString(), measurements: [] };
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const m = await measure(browser, vp, p);
      console.log(`measured ${vp.label} ${p.route}`);
      all.measurements.push(m);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, '_measurements.json'), JSON.stringify(all, null, 2));
  console.log(`\nWrote _measurements.json (${all.measurements.length} entries)`);
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
