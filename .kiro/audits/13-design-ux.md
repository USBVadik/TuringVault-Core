# Audit R14: Design + UX

**Auditor:** Kiro (automated)  
**Date:** 2025-06-14  
**Scope:** All 6 public pages of the TuringVault frontend  
**Live deployment:** https://frontend-seven-beta-46.vercel.app  
**Method:** Source code analysis (globals.css, layout.tsx, all page.tsx files, Navbar.tsx, animations.css) + live page fetch via web_fetch (rendered mode).

---

## 1. Scope & Method

| Surface | Method |
|---------|--------|
| Homepage (/) | web_fetch rendered + source read |
| /challenge | web_fetch rendered + source read |
| /backtest | web_fetch rendered + source read |
| /proof-explorer | web_fetch rendered + source read |
| /discipline | web_fetch rendered + source read |
| /social | web_fetch rendered + source read |
| Screenshots | **Not checked** — `scripts/audit/screenshot-pages.js` does not exist |
| Lighthouse | **Not checked** — Playwright/Lighthouse not installed in workspace |
| axe-core | **Not checked** — no automated a11y runner configured (axe-core npm package IS in node_modules via eslint-plugin-jsx-a11y but no standalone runner) |

---

## 2. Design Token Inventory (Current State)

### Fonts
- **Primary:** Space Grotesk (Google Fonts), weights 400/500/600/700
- **Mono:** JetBrains Mono (Google Fonts), weights 400/500/700
- CSS var: `--font-space-grotesk`, `--font-jetbrains-mono`

### Colors (CSS custom properties in `:root`)
| Token | Value | Usage |
|-------|-------|-------|
| `--vault-bg` | `#030308` | Page background |
| `--vault-surface` | `rgba(10,10,20,0.7)` | Card surfaces |
| `--vault-glass` | `rgba(14,14,28,0.5)` | Glass layers |
| `--vault-glass-border` | `rgba(120,80,255,0.1)` | Glass card border |
| `--purple-primary` | `#7c3aed` | Brand primary |
| `--purple-glow` | `#a855f7` | Glow/accent |
| `--purple-deep` | `#4c1d95` | Deep purple |
| `--green-primary` | `#10b981` | Success/positive |
| `--green-glow` | `#34d399` | Green glow |
| `--text-primary` | `rgba(255,255,255,0.95)` | Body text |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Secondary labels |
| `--text-muted` | `rgba(255,255,255,0.3)` | Muted/hint text |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Dividers |
| `--border-accent` | `rgba(124,58,237,0.25)` | Accent borders |

### Spacing
- No formal spacing scale defined in CSS vars
- Layout: `max-w-[1200px]` on homepage, `max-w-5xl` on sub-pages, `max-w-4xl` on challenge
- Padding observed: `p-8`, `p-6`, `p-5`, `p-10` (Tailwind arbitrary)
- Gap: `gap-5`, `gap-4`, `gap-3`, `gap-6` (inconsistent across sections)

### Motion
- `fadeUp`: 0.7s cubic-bezier(0.16, 1, 0.3, 1)
- `orbFloat`: 25–35s ease-in-out infinite
- `livePulse`: 2s ease-in-out infinite
- `brainSpin`: 6–10s linear infinite
- `corePulse`: 3s ease-in-out infinite
- `shimmer`: 1.5s ease-in-out infinite
- `termFadeIn`: 0.3s ease-out
- Proof Explorer: `float` 6s, `scan-line` 4s, `pulse-glow` 3s, `arrow-pulse` 2s

### Border Radius
- Cards: `16px` (glass-card), `24px` (glass-hero)
- Buttons: `12px`
- Inputs: `10px`
- Badges: `9999px` (pill)
- Sub-pages use Tailwind `rounded-lg` (8px), `rounded-xl` (12px)

---

## 3. 8-Dimension Rubric (per page, 1–5 scale)

### 3.1 Homepage (/)

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 4 | Space Grotesk is a strong DeFi choice. Clear h2 at 3xl/4xl. stat-number at 36px/800wt with gradient fill. Mono used correctly for data. Minor: body lacks explicit line-height token. |
| Spacing/Grid | 3 | Good max-width constraint (1200px). Partner bar well-spaced (gap-40). However the 3-col grid for terminal+funding has no responsive breakpoint — will collapse poorly on tablet. Gap values vary (5/6/8) with no system. |
| Color | 4 | Purple→green gradient is distinctive and used consistently. Glass surfaces with subtle alpha create depth. Red/yellow/green semantic colors appropriately applied. Minor: too many alpha variants of the same purple (0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3) — could consolidate. |
| Hierarchy | 4 | Clear visual hierarchy: hero → stats → performance → terminal → decisions. The demo-mode banner is appropriately prominent. Section headers use consistent `text-xs font-bold uppercase tracking-[0.2em]` pattern. |
| Microinteractions | 4 | Glass-card hover with border glow + translateY(-2px) + box-shadow is polished. hover-lift, hover-glow, hover-scale utilities available. stat-card-interactive subtle hover. Button press (scale 0.97). link-underline animation. |
| Motion | 4 | Orb floating background creates atmosphere without distraction. fadeUp stagger on load (7 delay steps). Terminal lines animate in. Brain rings spin at different speeds/directions. Cursor blink on reasoning. |
| Hero/Wow | 5 | The AI brain animation with spinning rings + pulsing core is eye-catching. Orb background with noise overlay and grid creates a premium "Linear meets dYdX" aesthetic. Live notification toast sliding in from right on new decisions. |
| Information Design | 4 | Stats sourced with tooltips explaining data source. Demo mode banner is honest. Decision log table is scannable with tx links. Strategy panel shows all relevant context. Minor: the 3-col stat row in hero is tight on small screens. |

**Page Average: 4.0/5**

### 3.2 /challenge (Adversarial Challenge)

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 3 | h1 at 3xl is consistent. Attack cards use `text-lg` for labels. Body text hierarchy is clear but result blocks lean on many font-size micro-classes (10px, 11px, 9px). |
| Spacing/Grid | 3 | 4-col grid for attack buttons works well. Result timeline is well-sequenced. However padding jumps between p-6 and p-3 inconsistently. |
| Color | 4 | Green/red semantic for blocked/succeeded is clear. Mode badges (emerald=live, yellow=preview) are distinct. Agent cards use purple/cyan/amber tone coding. |
| Hierarchy | 4 | Clear flow: select attack → loading progress → verdict → timeline. ModeBadge at top makes mode immediately visible. |
| Microinteractions | 3 | Button hover/disabled states exist. Loading progress timeline with animated dots. No transition on result cards appearing. |
| Motion | 2 | Only the loading dots pulse. No entry animations on results. Page feels static compared to homepage. |
| Hero/Wow | 3 | The live pipeline visualization (stage progress with GLM-5→Claude→Gemini) is engaging when running. Empty state is bland. |
| Information Design | 5 | Excellent: verbatim agent reasoning displayed, on-chain tx links, timing data, IPFS CID, budget usage. Honest mode differentiation (LIVE vs PREVIEW). |

**Page Average: 3.4/5**

### 3.3 /backtest (Live Performance)

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 3 | Consistent with site-wide styles. StatCard label at 10px uppercase works. Equity curve axis labels at 9px are borderline too small. |
| Spacing/Grid | 3 | 4-col stat grid is balanced. Equity curve container is well-sized (h-48). Trade table lacks horizontal rhythm (5 equal cols regardless of content width). |
| Color | 3 | Green/red/purple/blue for stat types is clear but the equity curve gradient (purple→green) doesn't encode meaning well. Trade table row colors work. |
| Hierarchy | 3 | Summary → curve → table is logical. But no section headers between them — just background-color changes provide separation. |
| Microinteractions | 2 | No hover on stat cards. No hover on trade rows. SVG chart is static (no tooltips or hover states). |
| Motion | 1 | No animations at all on this page. Content appears instantly. No skeleton-to-content transition despite having a BacktestSkeleton component. |
| Hero/Wow | 2 | The SVG equity curve is functional but plain. No trade markers on hover. No "hero moment" — it's a data table. |
| Information Design | 4 | Data source clearly stated. PnL methodology explained. Normalized $100 start is a good framing. Positive/negative/neutral breakdown is useful. |

**Page Average: 2.6/5**

### 3.4 /proof-explorer

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 4 | Strong hero headline "The AI tried to panic-sell ETH. TuringVault blocked it." Great copywriting. Shimmer text effect on key phrases. |
| Spacing/Grid | 4 | Pipeline visualization uses a clean vertical flow. Ecosystem stack grid is well-organized. Decision log accordion is scannable. |
| Color | 4 | Green for approved, red for blocked, amber for warning — consistent semantic palette. Shield icons and card borders follow system. |
| Hierarchy | 5 | Narrative hero → blocked cases → pipeline → ecosystem → audit log → identity. Excellent progressive disclosure with expandable rows. |
| Microinteractions | 4 | card-hover with translateY(-2px) + box-shadow. Float animation on shield icon. Arrow-pulse on pipeline connectors. Expandable decision rows. |
| Motion | 4 | Scan-line effect, float-gentle, glow-red pulse, shimmer-text, arrow-animate. Multiple layers of subtle motion create a premium feel. |
| Hero/Wow | 5 | The "blocked trades that would have lost money" narrative with real tx hashes and "ETH recovered +1.2%" is the best storytelling page. Pipeline visualization is compelling. |
| Information Design | 5 | Every decision has validator reasoning, risk score, gate decision, on-chain proof link. Ecosystem stack links to source code. Agent card displayed. |

**Page Average: 4.4/5** ← Best page

### 3.5 /discipline

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 3 | Consistent with system. Tile labels at 9px uppercase tracking-widest. Table uses font-mono at xs. |
| Spacing/Grid | 3 | 4-col summary grid works. Table has adequate spacing. Click-to-expand rows use full-width colspan. |
| Color | 3 | Emerald/red/amber semantic tiles. Status symbols (✓/✗/⚠/○) with color coding. Minimal but functional. |
| Hierarchy | 3 | Summary → latest → history is logical. But the page feels like a raw data view rather than an insight-first design. |
| Microinteractions | 2 | Table rows have hover highlight (bg-white/[0.02]). Expand/collapse on click. No transitions. |
| Motion | 1 | No animations. Page appears instantly. No entry effects. |
| Hero/Wow | 2 | Functional data table. No storytelling. No visual explanation of what the discipline layer does beyond the subtitle text. |
| Information Design | 4 | Gate pass rates clearly shown. n/a with tooltip for tx_proof when no swaps occurred (honest). Relative timestamps. Full JSON expandable. |

**Page Average: 2.6/5**

### 3.6 /social

| Dimension | Score | Observations |
|-----------|-------|-------------|
| Typography | 3 | Header hierarchy clear. Stat labels at 9px uppercase. Signal badges (BULLISH/BEARISH/NEUTRAL) are readable. |
| Spacing/Grid | 3 | 2-col card grid works. Within cards: 3-col metrics + 2-col engagement below. Adequate internal spacing. |
| Color | 4 | Signal-based card backgrounds (green for bullish, red for bearish) are immediately scannable. Emerald/red/white text colors match. |
| Hierarchy | 3 | Flat layout — all tickers at same level. No summary or aggregated view before the cards. |
| Microinteractions | 2 | Input has focus border color change. No card hover effects. No transitions on data refresh. |
| Motion | 1 | No animations. Loading state is text-only ("loading…"). No skeleton or shimmer. |
| Hero/Wow | 2 | Functional but unremarkable. The "add ticker" interaction is nice but minimal. |
| Information Design | 4 | Honest handling of missing API key. Clear explanation of what "null sentiment" means. Source links to code. Raw JSON link per ticker. |

**Page Average: 2.8/5**

---

## 4. Summary Scores

| Page | Avg Score |
|------|-----------|
| Homepage (/) | 4.0 |
| /proof-explorer | 4.4 |
| /challenge | 3.4 |
| /social | 2.8 |
| /backtest | 2.6 |
| /discipline | 2.6 |
| **Overall** | **3.3/5** |

---

## 5. 3-Way Comparison with Reference Dashboards

### vs Linear (linear.app)
| Aspect | Linear | TuringVault | Gap |
|--------|--------|-------------|-----|
| Font pairing | Inter + JetBrains Mono | Space Grotesk + JetBrains Mono | ✓ Competitive — Space Grotesk is a strong substitute for Inter in the crypto space |
| Background | Pure #000 or very dark gray, no decorative elements | #030308 + orbs + noise + grid | TuringVault is more decorative; Linear is more minimal |
| Card style | Subtle 1px border, no glass | Glass morphism with backdrop-filter | Different aesthetic — TuringVault's glass fits DeFi conventions |
| Spacing rhythm | 4px base, extremely consistent | No formal base unit; varies 3–10 Tailwind units | **Gap: needs a 4px/8px spacing scale** |
| Text opacity layers | 3 levels (100%, 60%, 40%) | 5+ levels (95%, 60%, 40%, 30%, 25%, 20%) | Too many opacity levels — consolidate to 3 |
| Transitions | 150ms ease everywhere | 0.2–0.3s ease/cubic-bezier, varies | Minor inconsistency but acceptable |

### vs Vercel Dashboard
| Aspect | Vercel | TuringVault | Gap |
|--------|--------|-------------|-----|
| Navbar | Fixed, minimal, border-b | Fixed, backdrop-blur, border-b | ✓ Competitive |
| Data tables | Clean grid with consistent column widths | 5-col equal grid regardless of content | **Gap: columns should be content-proportional** |
| Empty states | Illustrated, with CTA | Text-only "Select an attack vector above" | **Gap: needs illustrated empty states** |
| Loading states | Skeleton shimmer | Homepage has skeleton; sub-pages have basic skeletons or text "loading…" | **Partial gap: /social has no skeleton** |
| Section separation | White space + subtle top-border | Glass cards as containers + mb-8 gaps | Acceptable different approach |

### vs Stripe/Mercury
| Aspect | Stripe/Mercury | TuringVault | Gap |
|--------|----------------|-------------|-----|
| Stat cards | Large number, small label below, consistent sizing | Same pattern ✓ | Match |
| Charts | Recharts/D3 with hover tooltips, axis labels | Raw SVG with no interactivity | **Gap: equity curve needs hover tooltips** |
| Actionable copy | Every stat links to drill-down | Some stats link (Explorer links), most don't | Minor gap |
| Color for PnL | Green up / red down | Same ✓ | Match |
| Mobile responsiveness | Full responsive grid | Only homepage has `@media (max-width: 768px)` | **Gap: sub-pages have no mobile rules** |

---

## 6. Key Findings (ordered by severity)

### P0 — User-visible issues
1. **Sub-pages lack entry animations** — /backtest, /discipline, /social have zero motion, creating a jarring contrast with the animated homepage.
2. **Equity curve has no interactivity** — SVG chart lacks hover tooltips, crosshair, or any way to inspect individual data points.
3. **Mobile responsiveness missing on sub-pages** — Only homepage defines `@media (max-width: 768px)`. All sub-pages will break on mobile.

### P1 — Design consistency
4. **Spacing scale undefined** — No formal 4px/8px base. Gap/padding values are arbitrary across pages.
5. **Too many text opacity levels** — 6+ alpha values for white text; should consolidate to 3 (primary/secondary/muted).
6. **Max-width inconsistency** — Homepage uses `max-w-[1200px]`, backtest/discipline use `max-w-5xl` (1024px), challenge uses `max-w-4xl` (896px), social uses `max-w-[1100px]`.

### P2 — Polish
7. **No page transitions** — Navigation between pages is a hard cut. No shared layout animation.
8. **Empty states are text-only** — Challenge page and Social loading states lack visual interest.
9. **Table column widths are equal-grid** — Decision log table uses `grid-cols-5` regardless of content, wasting space.

---

## 7. Not Checked

| Item | Reason |
|------|--------|
| Actual screenshots | `scripts/audit/screenshot-pages.js` does not exist; Playwright not installed |
| Lighthouse scores (Performance, Accessibility, SEO) | No Lighthouse CLI or Playwright available in workspace |
| axe-core automated a11y scan | No standalone runner configured (package exists as eslint-plugin-jsx-a11y dep) |
| Mobile viewport rendering | Cannot render pages at mobile widths from this environment |
| Cross-browser rendering | No BrowserStack or similar available |
| Font loading performance (CLS) | Would require real Lighthouse; Google Fonts use `next/font` which is good practice |

---

## 8. 10 Quick Wins

| # | Fix | Est. Time | Visual Impact |
|---|-----|-----------|---------------|
| 1 | Add `anim-fade-up` class + stagger delays to /backtest, /discipline, /social page wrappers | 15 min | High — immediate polish parity with homepage |
| 2 | Add hover tooltips to equity curve SVG (show price + PnL on point hover) | 45 min | High — makes chart interactive like Stripe |
| 3 | Standardize max-width to `max-w-[1200px]` across all pages | 10 min | Medium — consistent layout width |
| 4 | Add `@media (max-width: 768px)` rules to sub-pages (stack grids to 1-col) | 30 min | High — prevents mobile breakage |
| 5 | Consolidate text opacity to 3 levels: replace `text-white/20`, `text-white/25` with `text-white/30` (muted) | 20 min | Low — cleaner visual rhythm |
| 6 | Add illustrated empty state to /challenge (shield icon + subtitle when no attack selected) | 20 min | Medium — premium feel |
| 7 | Make decision log table columns proportional (`grid-template-columns: auto 1fr auto auto 2fr`) | 15 min | Medium — better data density |
| 8 | Add skeleton shimmer to /social loading state (currently shows "loading…" text) | 15 min | Medium — consistent loading pattern |
| 9 | Add subtle `stat-card-interactive` hover to /backtest StatCards and /discipline Tiles | 10 min | Low — micro-delight on data cards |
| 10 | Wrap partner bar in horizontal scroll on mobile instead of wrap (prevents 2-row awkwardness) | 15 min | Medium — clean mobile navigation |

**Total estimated time:** ~3.5 hours for all 10 wins.

---

## 9. Overall Assessment

The TuringVault frontend achieves a strong **3.3/5** overall design score, which is above-average for a hackathon solo-dev project. The homepage and proof-explorer are standout pages (4.0 and 4.4 respectively) with premium glass-morphism aesthetic, compelling animations, and honest data labeling.

The main weakness is **inconsistency between pages** — the homepage and proof-explorer received significant design attention while /backtest, /discipline, and /social are functional data views without animation or interactivity polish.

For the hackathon rubric's "Complete UX" criterion (40% of Real-World Validity), the top priority is ensuring the 10 quick wins are applied to bring sub-pages closer to the homepage's quality level.
