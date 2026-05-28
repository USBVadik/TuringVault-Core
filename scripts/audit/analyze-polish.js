#!/usr/bin/env node
/**
 * Analyze _measurements.json and surface concrete polish anomalies
 * with screenshot references. Emits machine-readable findings JSON.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '../../.kiro/audits/raw/screens-polish');
const raw = JSON.parse(fs.readFileSync(path.join(OUT, '_measurements.json'), 'utf8'));

function shotPath(viewport, slug, fold = false) {
  return `.kiro/audits/raw/screens-polish/screen-${viewport}-${slug}${fold ? '-fold' : ''}.png`;
}

const findings = [];
function add(severity, category, viewport, slug, title, evidence) {
  findings.push({
    severity, category, viewport, slug,
    screenshot: shotPath(viewport, slug),
    foldShot: shotPath(viewport, slug, true),
    title,
    evidence,
  });
}

// --- 1. SECTION-heading (H2) left-edge asymmetry — H2s should share an axis ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  // Only h2 (true section headers). H3 commonly lives in grid cards and would false-positive.
  // Bucket H2s by Y so we don't double-count H2s that genuinely sit side-by-side.
  const h2 = m.data.headings.filter(h => h.tag === 'h2' && h.rect.w > 0 && h.rect.x > 0);
  // Take only one H2 per row (lowest x in each row) — that is the section axis.
  const rows = new Map();
  h2.forEach(h => {
    const key = Math.round(h.rect.y / 40) * 40;
    if (!rows.has(key) || rows.get(key).rect.x > h.rect.x) rows.set(key, h);
  });
  const sectionH2 = [...rows.values()];
  if (sectionH2.length < 3) continue;
  const xs = sectionH2.map(h => h.rect.x);
  const distinct = [...new Set(xs)].sort((a,b)=>a-b);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (distinct.length >= 3 && (maxX - minX) >= 12) {
    add('P2', 'h2-axis-drift', m.viewport, m.page,
      `Section H2 left-edge drifts across ${distinct.length} x-positions (min ${minX}px, max ${maxX}px, spread ${maxX-minX}px)`,
      {
        positions: distinct,
        sample: sectionH2.slice(0, 10).map(h => ({ x: h.rect.x, y: h.rect.y, text: h.text.slice(0, 60) })),
      }
    );
  }
}

// --- 2. Border-radius mix per page ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const radii = Object.entries(m.data.bordersByRadius || {})
    .filter(([k,v]) => v > 0 && k !== '0px')
    .map(([k,v]) => ({ radius: k, count: v }))
    .sort((a,b)=>b.count-a.count);
  if (radii.length >= 4) {
    add('P2', 'radius-mix', m.viewport, m.page,
      `${radii.length} distinct border-radius values used on the same page`,
      { radii: radii.slice(0,12) }
    );
  }
}

// --- 3. Card padding inconsistency per page (clusters) ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const cards = m.data.cards.filter(c => c.padding[0] > 0);
  // signatures of padding tuples
  const padSig = new Map();
  cards.forEach(c => {
    const k = c.padding.join('/');
    if (!padSig.has(k)) padSig.set(k, []);
    padSig.get(k).push(c);
  });
  const distinct = [...padSig.keys()];
  if (distinct.length >= 5) {
    const samples = [...padSig.entries()]
      .sort((a,b)=>b[1].length - a[1].length)
      .slice(0,8)
      .map(([k,v])=>({ padding: k, count: v.length, exampleCls: v[0].cls.slice(0,40) }));
    add('P2', 'card-padding-mix', m.viewport, m.page,
      `${distinct.length} distinct card-padding signatures on the page`,
      { topPaddings: samples }
    );
  }
}

// --- 4. Buttons in same row with different heights ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  // Bucket buttons by horizontal row (y within 4px) with at least 2 in row.
  const buttons = m.data.buttons.filter(b => b.rect.h > 0 && b.rect.w > 0);
  const rows = new Map();
  buttons.forEach(b => {
    const key = Math.round(b.rect.y / 8) * 8;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(b);
  });
  for (const [y, btns] of rows) {
    if (btns.length < 2) continue;
    const heights = btns.map(b => b.rect.h);
    const minH = Math.min(...heights), maxH = Math.max(...heights);
    if (maxH - minH >= 6) {
      add('P2', 'button-height-mismatch', m.viewport, m.page,
        `Buttons in same row at y≈${y} differ by ${maxH-minH}px (min ${minH} / max ${maxH})`,
        { buttons: btns.map(b => ({ text: b.text, h: b.rect.h, w: b.rect.w, cls: b.cls.slice(0,40) })) }
      );
      break; // one finding per page
    }
  }
}

// --- 5. SVG icon size inconsistency in same row ---
// (Only true svg/img — emoji bounds reflect parent text, not the glyph.)
for (const m of raw.measurements) {
  if (!m.data) continue;
  const icons = m.data.icons.filter(i =>
    (i.tag === 'svg' || i.tag === 'img') &&
    i.rect.w > 8 && i.rect.w < 64 && i.rect.h > 8 && i.rect.h < 64
  );
  const rows = new Map();
  icons.forEach(i => {
    const key = Math.round(i.rect.y / 4) * 4;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(i);
  });
  for (const [y, list] of rows) {
    if (list.length < 3) continue;
    const sizes = list.map(i => i.rect.w);
    const minS = Math.min(...sizes), maxS = Math.max(...sizes);
    if (maxS - minS >= 8 && maxS / Math.max(1, minS) >= 1.6) {
      add('P2', 'icon-size-mix', m.viewport, m.page,
        `SVG icons in same row at y≈${y} have widths from ${minS}px to ${maxS}px`,
        { icons: list.slice(0,8).map(i => ({ tag: i.tag, w: i.rect.w, h: i.rect.h, cls: i.cls.slice(0,40) })) }
      );
      break;
    }
  }
}

// --- 6. Emoji + lucide svg mix ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const emojis = m.data.icons.filter(i => i.tag === 'emoji');
  const svgs = m.data.icons.filter(i => i.tag === 'svg');
  if (emojis.length > 0 && svgs.length > 0) {
    add('P2', 'icon-mix-emoji-svg', m.viewport, m.page,
      `Page mixes ${emojis.length} emoji glyphs with ${svgs.length} svg icons`,
      { emojiSamples: emojis.slice(0,6).map(e=>({text:e.text, x:e.rect.x, y:e.rect.y, cls:e.cls})) }
    );
  }
}

// --- 7. Multiple distinct "live green" tones ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const greens = m.data.colors.greens || [];
  if (greens.length >= 3) {
    add('P2', 'green-color-drift', m.viewport, m.page,
      `${greens.length} distinct green background tones in use`,
      { greens }
    );
  }
}

// --- 8. Empty-state token mix on same page ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const tokens = new Set(m.data.emptyStates.map(e => e.text));
  if (tokens.size >= 2) {
    add('P2', 'empty-state-mix', m.viewport, m.page,
      `Mixed empty-state tokens on same page: ${[...tokens].join(' | ')}`,
      { samples: m.data.emptyStates.slice(0,12) }
    );
  }
}

// --- 9. z-index inventory >= 5 distinct values (potential conflicts) ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const zs = [...new Set(m.data.zIndex.map(z => z.z))].sort((a,b)=>parseInt(a,10)-parseInt(b,10));
  if (zs.length >= 4) {
    add('P2', 'z-index-stack', m.viewport, m.page,
      `${zs.length} distinct z-index values on page: ${zs.join(', ')}`,
      { sample: m.data.zIndex.slice(0,10) }
    );
  }
}

// --- 10. Gap inconsistency: same flex/grid axis with multiple values ---
for (const m of raw.measurements) {
  if (!m.data) continue;
  const gaps = m.data.gaps.filter(g => g.col && g.col !== 'normal' && parseFloat(g.col) > 0);
  const colVals = [...new Set(gaps.map(g => g.col))];
  if (colVals.length >= 6) {
    add('P2', 'gap-mix', m.viewport, m.page,
      `${colVals.length} distinct horizontal gap values used`,
      { gaps: colVals.slice(0,12) }
    );
  }
}

// --- 11. Container width drift across pages on same viewport ---
const widthByPageVp = {};
for (const m of raw.measurements) {
  if (!m.data) continue;
  // find biggest non-body card / heading container width as proxy
  const cards = m.data.cards.filter(c => c.rect.w > 400);
  if (!cards.length) continue;
  const maxW = Math.max(...cards.map(c => c.rect.w));
  widthByPageVp[m.viewport] = widthByPageVp[m.viewport] || {};
  widthByPageVp[m.viewport][m.page] = maxW;
}
for (const [vp, byPage] of Object.entries(widthByPageVp)) {
  const widths = Object.values(byPage);
  const minW = Math.min(...widths), maxW = Math.max(...widths);
  if (maxW - minW >= 100) {
    findings.push({
      severity: 'P1',
      category: 'container-width-drift',
      viewport: vp,
      slug: 'cross-page',
      screenshot: shotPath(vp, 'home', true),
      title: `Page max-content widths drift by ${maxW-minW}px across pages on ${vp}px viewport`,
      evidence: { byPage }
    });
  }
}

const out = {
  generated_at: new Date().toISOString(),
  viewport_count: 3,
  page_count: 6,
  total_findings: findings.length,
  by_severity: findings.reduce((a, f) => (a[f.severity] = (a[f.severity]||0)+1, a), {}),
  by_category: findings.reduce((a, f) => (a[f.category] = (a[f.category]||0)+1, a), {}),
  findings,
};
fs.writeFileSync(path.join(OUT, '_findings.json'), JSON.stringify(out, null, 2));
console.log(`Findings: ${findings.length}`);
console.log('By severity:', out.by_severity);
console.log('By category:', out.by_category);
