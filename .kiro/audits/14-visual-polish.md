# Audit R14: Visual Polish (multi-viewport)

**Auditor:** Kiro (automated)
**Date:** 2026-05-28
**Live deployment:** https://frontend-seven-beta-46.vercel.app
**Method:** Playwright Chromium 1.60, headless, `reducedMotion: 'reduce'`, `colorScheme: 'dark'`. 6 routes × 3 viewport widths (1440, 1024, 768) → **18 full-page screenshots + 18 above-the-fold screenshots** at `.kiro/audits/raw/screens-polish/`. Per-page DOM measurements (heading bounding boxes, card padding/radius/bg, button heights, icon sizes, z-index, gaps, empty-state tokens) extracted via `scripts/audit/measure-polish.js` and written to `.kiro/audits/raw/screens-polish/_measurements.json` (~675 KB). Findings produced by deterministic rules in `scripts/audit/analyze-polish.js` and saved to `_findings.json`.

> **Honesty note** — every finding below cites a specific screenshot file and a specific measured value (px, css-tuple, css-color). I did not eyeball "looks off". If a check would have been visual-only (e.g. "edge looks too hard"), it was deliberately excluded — see §5 Not checked.

---

## 1. Scope and method

| Surface | Method | Captured |
|---|---|---|
| `/` (home) | full page + above-fold @ 1440 / 1024 / 768 | `screen-{vp}-home.png`, `screen-{vp}-home-fold.png` |
| `/backtest` | same | `screen-{vp}-backtest{,-fold}.png` |
| `/challenge` | same | `screen-{vp}-challenge{,-fold}.png` |
| `/discipline` | same | `screen-{vp}-discipline{,-fold}.png` |
| `/proof-explorer` | same | `screen-{vp}-proof-explorer{,-fold}.png` |
| `/social` | same | `screen-{vp}-social{,-fold}.png` |

Run timestamp: 2026-05-28T15:32 PT (see `_manifest.json` for per-shot HTTP status, all 18 returned **status: ok**).

Findings counted: **29 total** (2 P1, 27 P2). 35 screenshots taken across 18 pages (full + fold for each).

---

## 2. Findings ordered by severity

### P1.1 — Container width drifts ~664 px across pages on the same viewport

| What | Value |
|---|---|
| **Surface** | All 6 pages, 1440-px viewport |
| **Screenshots** | `.kiro/audits/raw/screens-polish/screen-1440-home.png`, `screen-1440-backtest.png`, `screen-1440-challenge.png`, `screen-1440-discipline.png`, `screen-1440-proof-explorer.png`, `screen-1440-social.png` |
| **Expected** | All pages share a single content max-width (e.g. `max-w-[1200px]` everywhere) so the eye finds the same column on navigation. |
| **Actual @ 1440** | Largest content card per page: home **1152 px**, backtest **1200 px**, challenge **1200 px**, discipline **1200 px**, proof-explorer **1232 px**, social **568 px** (single ticker card; the `<main>` itself is `max-w-[1200px]` but content collapses to a 568-px column with empty right rail). Spread = **664 px**. |
| **Actual @ 1024** | home 976, backtest 960, challenge 960, discipline 960, proof-explorer 976, social 480. Spread = **496 px**. |
| **Root cause** | `frontend/app/proof-explorer/client.tsx` uses `max-w-7xl` (=1280 px) for the compact header and main, while every other page sets `max-w-[1200px]`. `frontend/app/social/page.tsx` reaches `max-w-[1200px]` on the `<main>` but only renders one ticker on first paint, leaving a half-empty viewport. |
| **Fix** | Standardise `max-w-[1200px]` on all pages (replace `max-w-7xl` in proof-explorer header + main). For `/social`, render at minimum a 2-column grid so the right rail is not empty on desktop. |

Evidence in `_findings.json` → `category: "container-width-drift"` (2 entries: 1440 and 1024).

---

### P1.2 — Section H2 axis drift on `/proof-explorer` (40 px wobble across 5 H2s)

| What | Value |
|---|---|
| **Surface** | `/proof-explorer` at every viewport |
| **Screenshots** | `screen-1440-proof-explorer.png` (rows at y≈621, 717, 1088, 1303, 1633) and `screen-1024-proof-explorer.png`, `screen-768-proof-explorer.png` |
| **Expected** | All section H2s should share one `x` axis. |
| **Actual @ 1440** | Five H2 left-edges at **104, 129, 136, 144 px** (4 distinct X positions, spread = 40 px). Specifically: "Decision Audit Log" sits at 104, "Decision Pipeline" + "Ecosystem Stack Used In This Proof" at 129, "Protected Capital — Trades That Would Have Lost" at 136, "Proof Explorer" at 144. |
| **Actual @ 1024 / 768** | Same 40-px spread (positions 24 / 49 / 56 / 64). |
| **Root cause** | Mixed inner-section padding: some sections wrap H2 in a `glass-card` (≈40-px lateral padding), some sit directly on `max-w-7xl mx-auto px-6`, some inside additional `px-2`/`px-4` wrappers. |
| **Fix** | Wrap every page section in the same container shell (e.g. `<section class="px-0 mb-10">…<h2 class="text-... mb-4">`) so the H2 axis equals the page's `mx-auto` axis. |

Evidence: `_findings.json` → `category: "h2-axis-drift"` (3 entries, all `/proof-explorer`).

---

### P2.1 — Card-padding signatures: 10 distinct on `/`, 7 on `/proof-explorer`, 5 on `/backtest`

| Surface | Distinct padding tuples found | Evidence |
|---|---|---|
| `/` @ 1440 | **10** | top tuples: `8/16/8/16` (×6), `12/12/12/12` (×5), `32/32/32/32` (×3, glass-card p-8), `24/24/24/24` (×3, glass-card p-6), `20/20/20/20`, `40/40/40/40` (glass-hero p-10), `6/12/6/12`, `2/8/2/8` |
| `/proof-explorer` @ 1440 | **7** | `12/12/12/12` (×46), `8/8/8/8` (×14), `8/16/8/16` (×7), `20/20/20/20` (×5), `24/24/24/24` (×2), `6/12/6/12`, `2/8/2/8` |
| `/backtest` @ 1440 | **5** | `12/12/12/12` (×8), `8/16/8/16` (×6), `24/24/24/24` (×2), `6/12/6/12`, `16/16/16/16` |

| What | Value |
|---|---|
| **Screenshots** | `screen-1440-home.png` (sections at y≈540, 1158, 2860 use 32-px, 24-px, 40-px padding within ~700 px of each other), `screen-1440-proof-explorer.png`, `screen-1440-backtest.png` |
| **Expected** | A spacing scale of **2–3 padding values** per page (e.g. `8` for chips, `20` for cards, `32` for hero) — a documented step in `globals.css` or `tailwind.config.ts`. |
| **Actual** | The same visual class (`glass-card`) is paired with `p-5`, `p-6`, `p-8`, `p-10` arbitrarily; chips and pills add 4 more padding tuples. |
| **Fix** | Define `--card-pad-sm: 16px; --card-pad-md: 24px; --card-pad-lg: 32px;` in `globals.css`. Replace ad-hoc Tailwind `p-5/p-6/p-8/p-10` on `glass-card` with three component variants (`glass-card-sm`, `glass-card`, `glass-card-hero`). |

Evidence: `_findings.json` → `category: "card-padding-mix"` (9 entries, 3 viewports × 3 worst pages).

---

### P2.2 — Icon vocabulary mix: emoji + lucide SVG on the same surfaces

| Surface | Emoji glyphs | Lucide SVGs | Worst examples |
|---|---|---|---|
| `/` | **12** | 31 | `⚠ Last cycle` warning row at (144, 1158) sits 48 px above `<svg lucide-...>` icons; reasoning ticker mixes `→`, `⚡`, `✓` (text glyphs at y≈1803/2096/2124) with lucide icons in the same column. |
| `/discipline` | **36** | 8 | Entire status table renders gates as `✓` text (text-emerald-400) at `(145, 496)`, `(145, 516)`, `(752, 671)`, `(939, 671)`, …, while header bar uses lucide. So same "approved" concept is encoded with two different glyph types on one screen. |
| `/proof-explorer` | 2 | 21 | `📊 Grid ` at (125, 2822), `⚠️ Adver…` at (125, 3013) sit between ~20 lucide SVGs in the ecosystem section. |

| What | Value |
|---|---|
| **Screenshots** | `screen-1440-home.png`, `screen-1440-discipline.png`, `screen-1440-proof-explorer.png` (and `1024` / `768` mirrors) |
| **Expected** | One icon system per visual rank. Either lucide everywhere, or a deliberate "ASCII glyph row" treatment limited to the terminal/log component. |
| **Actual** | Coexistence in the same visual scope without label, breaking optical rhythm — the discipline table is the worst offender (36 emoji `✓` vs lucide-svg in the same view). |
| **Fix** | Replace `✓` / `⚠` / `→` / `⚡` text glyphs with lucide `<Check className="w-3 h-3 text-emerald-400" />`, `<AlertTriangle … />`, `<ArrowRight … />`, `<Zap … />`. Reserve text glyphs **only** for the terminal/console UI (already a monospace surface where glyph ≠ icon is intentional). |

Evidence: `_findings.json` → `category: "icon-mix-emoji-svg"` (9 entries).

---

### P2.3 — Horizontal-gap inconsistency on `/`: 9 distinct `column-gap` values

| What | Value |
|---|---|
| **Surface** | `/` at every viewport |
| **Screenshots** | `screen-1440-home.png`, `screen-1024-home.png`, `screen-768-home.png` |
| **Expected** | A small gap scale (e.g. 4 / 8 / 16 / 24 / 32 px) — **5 values max**. |
| **Actual** | flex/grid containers on `/` use **9 distinct column-gap values**: `4, 6, 8, 12, 16, 20, 24, 32, 40 px` (1440 and 1024). 768 swaps the order but keeps the same 9 values. |
| **Root cause** | `gap-1`, `gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-5`, `gap-6`, `gap-8`, `gap-10` are all in use across the homepage's hero, partner bar, terminal grid, stat row, decisions log. |
| **Fix** | Cut the scale to 5 (`4 / 8 / 16 / 24 / 40`); rewrite the homepage to use only those. The gap-5 (20 px) and gap-1.5 (6 px) variants are the easiest to delete without redesign. |

Evidence: `_findings.json` → `category: "gap-mix"` (3 entries).

---

### P2.4 — z-index inventory of 4 levels with negative + positive coexistence on `/`

| What | Value |
|---|---|
| **Surface** | `/` at every viewport |
| **Screenshots** | `screen-1440-home.png` (toast at bottom-right `(1127, 3718)` z=50, `orb-bg` z=-2, `noise-overlay` + `grid-bg` + `hero-mesh-bg` all z=-1, contracts panel gradient z=-10) |
| **Expected** | A documented stack (e.g. background = -1, content = 0, overlays = 10, navbar = 50, toast = 60). |
| **Actual** | **4 distinct z-index values** — `-10, -2, -1, 50`. The `-2 / -1 / -10` mix means the contracts-panel gradient (z=-10) is physically below the noise+orb backgrounds and may not render on top of the page background as intended on layered-blend browsers. |
| **Risk** | Currently no clipping observed in screenshots, but any future tooltip/dropdown using `z=auto` inside a sibling of `<main>` would be obscured by the navbar (`z-50`) without warning. |
| **Fix** | Document the z-scale once in `globals.css` (`--z-bg: -1; --z-mesh: -2; --z-content: 0; --z-nav: 50; --z-toast: 60`). Drop `-z-10` to `-z-1` on the contracts-panel gradient. |

Evidence: `_findings.json` → `category: "z-index-stack"` (3 entries).

---

### P2.5 — Border-radius values: page-level mix

| Page | Distinct radius values among cards | Notes |
|---|---|---|
| `/` | 3 (`8`, `12`, `9999`/`pill`) | Hero buttons `rounded-xl` (12) sit in the same row as input chips `rounded-md` (8). |
| `/proof-explorer` | 3 (`8`, `12`, pill) — but the **mass of cards is `rounded-lg` (8)**, with a handful of `rounded-xl` hero cards (12). Same row, different radius is rare here. |
| `/backtest`, `/challenge`, `/discipline` | 2 each (`8`, pill). Internally consistent. |
| `/social` | 3 (`8`, `12`, pill). Ticker cards are `rounded-xl` (12), input chip `rounded-lg` (8). |

`3.35544e+07px` in raw data is the computed `getComputedStyle.borderTopLeftRadius` for `border-radius: 9999px` against tall elements — i.e. capsule/pill (filled-up to the height). It is one logical value, **not** a fourth.

| What | Value |
|---|---|
| **Severity** | P2 — mostly OK, only `/` shows visible mix (chips 8 px next to buttons 12 px in the same hero row). |
| **Fix** | Pin the homepage hero CTA to `rounded-lg` (8) to match its neighboring `<input>`/chip set, OR upgrade chips to `rounded-xl` (12) for parity. |

Evidence: `_measurements.json` → `data.bordersByRadius` per page; `_findings.json` does **not** flag this as `radius-mix` because the count threshold (≥4 distinct values) was not met — counted here as observation only.

---

## 3. Per-page polish summary

| Page | P1 issues | P2 issues | Worst single finding (1440 viewport) |
|---|---|---|---|
| `/` | 1 (container width drift, 1152 vs 1232) | gap-mix (9 values), card-padding-mix (10 sigs), icon-mix-emoji-svg (12+31), z-index 4 levels | 10 distinct card-padding signatures on one page |
| `/proof-explorer` | 1 (`max-w-7xl` while siblings use `max-w-[1200px]`) and H2 axis drift 40 px | card-padding-mix (7 sigs), icon-mix-emoji-svg (2+21) | H2s at x=104/129/136/144 |
| `/backtest` | none | card-padding-mix (5 sigs) | mostly clean — radius 8 + pill only |
| `/challenge` | none | none flagged by deterministic rules | mostly clean |
| `/discipline` | none | icon-mix-emoji-svg (36 emoji ✓ vs 8 lucide) | 36× text-glyph `✓` in the gate table |
| `/social` | indirect (collapses to 568-px column at 1440) | none flagged by rules | half-empty desktop viewport on first paint |

---

## 4. Quick-win patch list (in fix order)

| # | Fix | Files | Visible in screenshot |
|---|---|---|---|
| 1 | Replace `max-w-7xl` with `max-w-[1200px]` on `/proof-explorer` header + main | `frontend/app/proof-explorer/client.tsx:368, 413` | `screen-1440-proof-explorer.png` (32-px content shift inward) |
| 2 | Wrap every section on `/proof-explorer` in identical shell (no inner `glass-card` for headings) so all H2s share one axis | same file, around lines 230, 367, 413, plus all `<FadeIn><h2>` blocks | `screen-1440-proof-explorer.png` (H2 column at x=104..144) |
| 3 | Render `/social` in a 2-col grid even on first paint (placeholder ticker on the right column) | `frontend/app/social/page.tsx:129` | `screen-1440-social.png` (right rail empty) |
| 4 | Replace text-glyph `✓` / `⚠` in `/discipline` table cells with `<Check />` / `<AlertTriangle />` from lucide | `frontend/app/discipline/page.tsx` (status cells) | `screen-1440-discipline-fold.png` (gate columns) |
| 5 | Cut homepage gap scale to 5 values (drop `gap-1.5` and `gap-5`) | `frontend/app/page.tsx` (multiple) | `screen-1440-home.png` |
| 6 | Define 3-step card padding tokens; replace `p-5 / p-6 / p-8 / p-10` on `glass-card` with `glass-card-sm / glass-card / glass-card-hero` variants | `frontend/app/globals.css`, `frontend/app/page.tsx`, `frontend/app/proof-explorer/client.tsx` | `screen-1440-home.png` |
| 7 | Document z-scale in CSS variables; replace inline `-z-10`/`z-50` with `var(--z-*)` | `frontend/app/globals.css`, `frontend/app/components/Navbar.tsx`, `frontend/app/page.tsx` | n/a (preventative) |
| 8 | Standardise homepage hero radius — push input chip + CTA both to `rounded-xl` (12 px) | `frontend/app/page.tsx` (header CTA + chip) | `screen-1440-home-fold.png` |

Estimated total time: **~3 hours** for a careful pass.

---

## 5. Not checked (limits to honesty)

The following items from the audit prompt were **not verified in this pass** because the deterministic check would have produced unreliable results from a headless screenshot alone. They are excluded rather than reported with low confidence:

- **"Hard edges where soft expected" (banner fade-out, gradient endings, soft shadows)** — would require pixel-region sampling along element edges; not implemented. Manual visual review of `screen-1440-home.png` between y≈250 and y≈700 (hero-mesh-bg) is recommended.
- **"Misaligned text — stat labels not aligned to baseline / digits of different heights"** — would require glyph-level baseline measurement; the closest deterministic check (`button-height-mismatch`) returned no hits across all 18 pages, suggesting baseline drift, if any, is sub-6 px and below the noise floor of this method.
- **"Broken visual hierarchy — same weight on primary and secondary text"** — `font-weight` was sampled but not flagged; needs human judgment of "what is primary" per section.
- **"Empty-state token mix — `—` vs `N/A` vs skeleton"** — the deterministic walker found **0 occurrences** of any of `—`, `N/A`, `null`, `loading…`, `loading...`, `...`, `no data` on any of the 18 captures (every page rendered fully populated by the time of capture, possibly because Vercel had warm caches). Re-run during a cold start to validate.
- **"Color drift — multiple shades of live green"** — the deterministic check requires ≥3 distinct backgrounds with green dominance and a length-restricted text label; it returned **0 hits**, meaning per-page green chips share one background. There may still be drift in **text color** or **border** that this run did not measure.
- **"Tooltip clipping / dropdown under content"** — would require interaction (hover/focus) which the screenshot pass did not perform.

If a follow-up pass is requested for any of the above, ping a spec — they each need a different instrumentation script.

---

## 6. Artifacts

| File | Purpose |
|---|---|
| `.kiro/audits/raw/screens-polish/screen-{vp}-{page}{,-fold}.png` | 36 screenshots (18 full + 18 fold) |
| `.kiro/audits/raw/screens-polish/_manifest.json` | per-shot URL, viewport, HTTP status, ms |
| `.kiro/audits/raw/screens-polish/_measurements.json` | DOM measurements for every page (≈675 KB) |
| `.kiro/audits/raw/screens-polish/_findings.json` | machine-readable findings ledger (29 entries) |
| `scripts/audit/screenshot-polish.js` | repeatable screenshot script |
| `scripts/audit/measure-polish.js` | DOM-measurement extractor |
| `scripts/audit/analyze-polish.js` | finding-rule engine |

Re-run with:

```bash
node scripts/audit/screenshot-polish.js
node scripts/audit/measure-polish.js
node scripts/audit/analyze-polish.js
```

---

## 7. Overall

The site has a solid baseline (one font system, one color palette, one card vocabulary). The polish gaps that **show up in actual screenshots** are:

1. `/proof-explorer` is laid out 80 px wider than its siblings and its H2 axis wobbles 40 px — fixable in two CSS edits.
2. `/discipline` encodes its core "gate passed" concept as a text glyph 36× while the rest of the site uses lucide SVG — fixable in one component pass.
3. `/social` collapses to 568 px on a 1440-px viewport because of single-column first paint — fixable by rendering the empty-state placeholder in the right column.
4. `/` uses 9 column-gap values and 10 padding signatures — fixable with a documented spacing scale in `globals.css`.

None of these are user-truth violations (no UI claim contradicts the data). They are pure visual-rhythm issues that a hackathon judge will register subconsciously as "feels less premium than the headline pages". 3 hours of work converts the average from "high 3 / low 4" to "consistent 4+".
