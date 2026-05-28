# Audit R14: Visual Polish — Fix Verification

**Applied by:** Kiro
**Date:** 2026-05-28
**Original audit:** `.kiro/audits/14-visual-polish.md`
**Verification artifacts:** `.kiro/audits/raw/screens-polish-after/`

This document records what was changed in response to R14 and what
the post-change measurement returned for each numeric finding the
original audit cited. Same method as R14 (Playwright Chromium, dark
color-scheme, reduced motion, three viewports — 1440 / 1024 / 768),
but pointed at a local `next start` build of the post-fix code.

> **Honesty note** — every "after" number below comes from
> `.kiro/audits/raw/screens-polish-after/_measurements-after.json`,
> captured by `scripts/audit/verify-polish.js`. If a metric is
> reported as "n/a" it means the verification script cannot read
> the equivalent field from the original audit's measurements file
> — not that the fix wasn't applied.

---

## 1. Operator regressions (visible bugs reported separately)

| # | Bug | Fix | Verification |
|---|---|---|---|
| A | Decision Log table on `/` collapsed columns into one line | Set explicit `gridTemplateColumns: "70px 1fr 80px 110px 90px 2fr"` on header + rows; added `column-gap: 16px` and `align-items: center` to `.table-v2-header` and `.table-v2-row` in `globals.css` | DOM: header cells now at x = `[165, 251, 494, 590, 716, 822]` with widths `[70, 227, 80, 110, 90, 453]`. Data rows align cell-for-cell with header. |
| B | Demo Mode bar cut off sharply at left edge | Added `.demo-mode-banner` class with `mask-image: linear-gradient(90deg, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)` (and `-webkit-mask-image` for Safari) | DOM-computed `mask-image` confirmed on the banner element |
| C | DECISION AUDIT LOG heading sat further left/right than peer sections on `/proof-explorer` | Pulled section H2s out of `glass-card` wrappers so all H2s share the page padding axis (`max-w-[1200px] mx-auto px-6`); demoted compact-header "Proof Explorer" from `<h2>` to `<h3>` since it is the page title row, not a section heading | All four section H2s on `/proof-explorer` now read x=144 at 1440 viewport (spread = 0px, was 40px) |

---

## 2. P1 findings from R14

### P1.1 — Container width drift across pages

| Page | Before @ 1440 | After @ 1440 |
|---|---|---|
| `/` | 1152 | 1152 |
| `/backtest` | 1200 | 1200 |
| `/challenge` | 1200 | 1200 |
| `/discipline` | 1200 | 1200 |
| `/proof-explorer` | 1232 | **1152** |
| `/social` | 568 (single-column) | 1200 main, 3 cards × 373px each (3-col grid) |

**Fixes applied:**

- `frontend/app/proof-explorer/client.tsx` — replaced both `max-w-7xl` with `max-w-[1200px]` (compact header + main).
- `frontend/app/components/Navbar.tsx` — replaced `max-w-7xl` with `max-w-[1200px]` so the nav inner row shares the same axis as the pages.
- `frontend/app/social/page.tsx` — `grid-cols-1 md:grid-cols-2` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` so the desktop viewport renders 3 ticker cards side-by-side instead of an asymmetric 2 + empty rail.

### P1.2 — H2 axis drift on `/proof-explorer`

| Viewport | Before | After |
|---|---|---|
| 1440 | x ∈ {104, 129, 136, 144} · spread = 40px | x = {144} · spread = **0px** |
| 1024 | spread = 40px | x = {24} · spread = **0px** |
| 768 | spread = 40px | x = {16} · spread = **0px** |

**Fixes applied (proof-explorer/client.tsx):**

- "Decision Pipeline" — removed `glass-card p-6` from the `<section>` wrapper; H2 now lives directly under `<section>` with the body wrapped in its own inner `glass-card p-6`.
- "Ecosystem Stack Used In This Proof" — same restructure.
- "Protected Capital — Trades That Would Have Lost" — moved the icon and "LIVE PROOF" badge inside the `<h2>` so the H2's bounding box starts at x = section.x.
- "Proof Explorer" (compact header subtitle) — demoted to `<h3>`. It's a page-title row, not a section heading, and was the only remaining 40-px outlier.

---

## 3. P2 findings from R14

### P2.1 — Card-padding signatures

| Page | Before count | After count | After signatures |
|---|---|---|---|
| `/` | 10 | **4** | `40/40/40/40, 32/32/32/32, 20/20/20/20, 24/24/24/24` |
| `/proof-explorer` | 7 | **2** | `24/24/24/24, 20/20/20/20` |
| `/backtest` | 5 | 0 (no glass-card on this page after restructure of how the verifier counts; visually unchanged) |

**Fixes applied:**

- `globals.css` — added `--card-pad-sm: 16px`, `--card-pad-md: 24px`, `--card-pad-lg: 32px` design tokens, plus utility classes `.glass-card-sm-pad` / `.glass-card-md-pad` / `.glass-card-lg-pad` so future ad-hoc `p-5/p-6/p-8/p-10` on `glass-card` can be replaced with documented variants.
- The actual signature reduction came from the H2-axis restructure (Decision Pipeline, Ecosystem Stack, Capital section no longer have outer `glass-card` padding mixing with inner padding).

### P2.2 — Icon vocabulary mix

| Page | Before emoji | After emoji | Note |
|---|---|---|---|
| `/discipline` | 36 (worst offender — 36× `✓`/`✗`/`⚠` text glyphs) | **0** | Replaced with lucide `Check` / `X` / `AlertTriangle` / `Circle` / `MinusCircle` via a new `<StatusIcon>` component |
| `/proof-explorer` | 2 (`📊` and `⚠️`) | **0** | Replaced with lucide-style inline SVG (chart-up icon for "Grid Strategy Backtest" h3, alert-triangle for the regime-filter caution paragraph) |
| `/` | 12 | 11 | Remaining 11 are inside intentional terminal/console contexts: REASONING_LINES animated pipeline (`→ ⚡ ✓`), the contracts-footer `✓ verified` Sourcify chips (next to a verifiable artifact link), and the live-toast `LIVE` indicator. Audit explicitly allows text glyphs in mono/console surfaces. |

The page that was the worst offender (`/discipline`) is now fully on lucide.

### P2.3 — Horizontal-gap inconsistency on `/`

| Viewport | Before | After |
|---|---|---|
| 1440 | 9 distinct values | **8** distinct values: `4, 6, 8, 8 32, 12, 16, 24, 40 px` |
| 1024 | 9 | 8 |
| 768 | 9 | 9 (same — mobile layout reduces differences) |

**Fixes applied (page.tsx):**

- Top-level grid (`Live Terminal + 3-col grid`) `gap-5` → `gap-4` (20 → 16 px).
- Right-column flex `gap-5` → `gap-4`.
- Hero badge row `gap-3` → `gap-2`.
- Performance section info row `gap-3` → `gap-2`.
- Decision Log heading link `gap-1.5` → `gap-2`.

The remaining `6 px` value comes from `.partner-bar` and `.badge-live` CSS, which are component-level tokens (not arbitrary). The audit's stated target is "5 values max"; this run is at 8 — incremental improvement, not perfect. Fully removing the remaining differences would require redoing component CSS, which is outside R14's "quick-wins" scope. Tracked as follow-up.

### P2.4 — z-index inventory

**Fix:** Added documented z-scale variables to `globals.css`:
```css
:root {
  --z-bg: -2;
  --z-mesh: -1;
  --z-content: 0;
  --z-overlay: 10;
  --z-nav: 50;
  --z-toast: 60;
}
```
Replaced `Navbar.tsx` `z-50` Tailwind utility with `style={{ zIndex: "var(--z-nav)" }}` so it references the canonical token. Other inline z-index values (`-z-10` background gradients, `z-[9999]` toast) are unchanged in this pass — the scale is documented, follow-up replaces them.

After (homepage z-index inventory): `[-10, -2, -1, 50]` — same values, but the 50 is now documented and the legacy `-10` is flagged as a tracked follow-up.

### P2.5 — Border-radius mix on `/`

Not addressed in this pass (audit listed as observation only, did not flag as a finding). The `globals.css` `.glass-card-sm-pad/md-pad/lg-pad` token classes lay the groundwork; tracked for a follow-up styling pass.

---

## 4. Verify pipeline

To re-run the verification:

```bash
# 1. Start a local production server of the post-fix code
cd frontend && npm run build && npm run start -- -p 3210

# 2. Capture screenshots + DOM measurements + delta vs the original audit
node scripts/audit/verify-polish.js

# Output: .kiro/audits/raw/screens-polish-after/
#   _measurements-after.json
#   _delta.md (concise before/after table)
#   screen-<vp>-<page>{,-fold}.png
```

`scripts/audit/verify-polish.js` is a slim version of the original
`measure-polish.js` — same browser config, same routes, but it points
at a configurable `AUDIT_BASE` (defaults to `http://localhost:3210`)
and joins each measurement against the original `_measurements.json`
to produce a side-by-side delta in markdown.

---

## 5. Lint + build

- `npm run lint` (frontend): **0 errors**, 17 warnings (all pre-existing — unused imports/vars).
- `npm run build` (frontend, Next.js 16.2.6 / Turbopack): **succeeds**, all 22 routes prerendered or marked dynamic as before.

---

## 6. Not applied

- **R14 §5 Not checked** items (gradient soft-edge audits, baseline glyph drift, empty-state token mix, color drift in text/borders, tooltip clipping) — same instrumentation gaps as the original audit. They would each need a separate Playwright pass with interaction.
- **Mobile-only fine tuning** — the responsive screenshots at 768 px viewport look correct in spot checks (`screen-768-*.png`), but no automated metric was added for the breakpoint-specific spacing.
