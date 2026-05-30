# Audit 30 — Design Slop Audit

**Date**: 2026-05-30
**Trigger**: Operator wants to polish design before re-recording
the demo video. AI-slop tells (mismatched tokens, generic
gradients, opacity drift, emoji-heavy headers) drag perceived
craft on a hackathon submission even when the data layer is
honest.

This audit produces:
- A quantitative inventory of design-token drift (text size,
  opacity, border, radius, spacing).
- A mapped list of P0/P1/P2 surfaces with file:line refs.
- A "10 quick wins" backlog the operator (or I) can ship in
  ≤30 min each.
- A reference-dashboard comparison so we know what "polished"
  looks like.

---

## Findings — quantitative inventory

### Text sizes — 17 distinct values (target: ≤ 8)

```
 222 text-[10px]
  76 text-[9px]
  73 text-xs
  61 text-sm
  30 text-[11px]
  20 text-xl
  19 text-lg
  19 text-[8px]
   9 text-3xl
   5 text-[12px]
   3 text-base
   3 text-[14px]
   3 text-2xl
   2 text-[28px]
   2 text-4xl
   1 text-[36px]
   1 text-[24px]
```

**P1 finding**: 17 distinct text-size values. Including 9
arbitrary-bracket values (`text-[8px]`, `text-[10px]`, …,
`text-[36px]`) that bypass the Tailwind scale. A real design
system has 5-7 sizes that follow a ratio (1.25 or 1.333).

The single biggest offender is `text-[10px]` (222 occurrences) —
that's a "shrunk-to-fit" pattern signalling the layout outgrew
the type scale.

### Text opacity — 13 distinct values (target: 3-4)

```
 107 text-white/30
  74 text-white/40
  27 text-white/20
  26 text-white/50
  23 text-white/60
  17 text-white/70
  16 text-white/25
  12 text-white/80
  10 text-white/90
   5 text-white/55
   4 text-white/15
   4 text-white/10
   1 text-white/35
```

**P1 finding**: 13 distinct opacity steps. R14-P2.2 in audit 99
already flagged this as "6+ alpha variants of white". It's now
13. A typical design system uses 3 levels (primary/secondary/
muted) plus disabled. Specific outliers (`/35`, `/55`) are
clearly one-offs.

### Border opacity — 9 distinct values

```
  24 border-white/5
  22 border-white/[0.06]
  19 border-white/[0.04]
   9 border-white/10
   1 border-white/[0.05]
   1 border-white/[0.03]
   1 border-white/8
   1 border-white/30
   1 border-white/20
```

**P2 finding**: `border-white/[0.06]` and `border-white/[0.04]`
both have ≥19 occurrences and are visually indistinguishable.
`border-white/8` and `border-white/[0.05]` are one-offs that
should probably be `/[0.06]`.

### Background opacity — 10 distinct values

```
  42 bg-white/[0.02]
  14 bg-white/5
   9 bg-white/[0.03]
   6 bg-white/[0.01]
   4 bg-white/[0.04]
   1 bg-white/[0.08]
   1 bg-white/[0.06]
   1 bg-white/[0.015]
   1 bg-white/30
   1 bg-white/10
```

**P2 finding**: 10 distinct surface tints, of which 5 have
≤4 occurrences each. The dominant `bg-white/[0.02]` is fine;
the others are noise.

### Border radius — 4 values, well-distributed

```
  62 rounded-lg     (default card)
  35 rounded-full   (pills, dots)
  11 rounded-md     (buttons)
  10 rounded-xl     (hero cards)
```

**OK finding**: Radius is the cleanest token in the system.
4 distinct values, each with a clear semantic role. No action
needed.

### Spacing — Tailwind scale used uniformly

The grep shows `p-3`, `p-4`, `p-6`, `gap-2`, `gap-3`, `gap-4`,
`gap-6` as the dominant patterns. **OK** — Tailwind's default
4-px scale is being respected. Audit 99 mentioned R14-P2.1
(formal 4px/8px scale) — `globals.css:1064-1077` already
defines `--space-1` through `--space-20`. The CSS variables
exist; they just aren't always referenced.

### Inline `style={{}}` — 12 occurrences

```
proof-explorer/client.tsx  6  (animation delays + radial-gradient backgrounds)
page.tsx                    5  (animation delays + grid template columns)
backtest/page.tsx          1  (chart tooltip positioning)
components/Navbar.tsx      1  (z-index var)
components/Skeleton.tsx    1  (dynamic grid columns)
```

**OK finding**: All 12 inline styles have a legitimate reason
(animation delay variables, dynamic grid columns based on prop,
radial-gradient that can't be a Tailwind utility). None of the
"AI built this without thinking about Tailwind" smell.

### Z-index — 4 unique values, mostly named

```
z-50          (RiskMascot)         — generic but contained
z-[9999]      (toast + skip-link)  — for very-on-top modals
z-10          (proof-explorer step indicators)
z-0           (decorative)
zIndex var    (Navbar — uses CSS variable)
```

**OK** — not a hot mess. Could consolidate by adding
`--z-toast` and `--z-modal` tokens to globals.css, but low
priority.

### AI-slop copy patterns — 0 hits

Scanned for: `harness`, `leverage`, `seamless`,
`cutting-edge`, `world-class`, `state-of-the-art`,
`enterprise-grade`, `democratize`, `unlock`, `empower`,
`paradigm`, `revolutionary`, `game-changer`. Zero matches.

**Excellent finding**: the copy is concrete, technical, and
specific. This is a major point in our favour — most AI-built
hackathon sites are stuffed with generic-marketing-pablum that
judges spot in 3 seconds. Ours isn't.

### Emoji density in JSX — 47 occurrences across 6 files

```
page.tsx                7  (mostly status symbols ⚠ ⚡ ✓ in dynamic state)
challenge/page.tsx      6  (✓ ⚠ for security flags)
replay/[id]/page.tsx    6  (✅ ⚠️ ✓ ✗ for binding verification)
replay/page.tsx         1  (⚓ for on-chain anchor — branded mark)
RiskMascot.tsx          5  (🟢 🟡 🔴 — semantic state, fine)
LiveTerminal.tsx        4  (⚠ — same)
```

**OK finding**: emoji are used as **semantic glyphs**
(✓ pass, ✗ fail, ⚠ warn, 🟢 active) in dynamic state, not as
decorative headers. There is NOT a `## 🎯 Big Header` problem
on the site. The submission *text* on DoraHacks has lots of
section emoji — that's fine for a hackathon submission and
arguably helps scannability. The site itself uses them
correctly.

### Generic gradient text — 1 hit

```
page.tsx:505  bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text
```

**P2 finding**: One purple-to-green gradient text on the
homepage hero (the "Proof-of-Reasoning" headline). This is the
classic AI-built-this-in-an-hour gradient. Could be:
- Kept (it IS our brand colour combo, not Bootstrap-defaults).
- Replaced with `text-white` + smaller `Proof-of-Reasoning`
  pre-headline like Linear / Mercury do.

I lean toward **keeping** because purple+green IS our brand
combination throughout the agent identity; making it text-only
white would feel inconsistent with the rest. But the headline
TEXT could be tightened — "The AI that proves why it didn't
trade" is the actual zinger; "Proof-of-Reasoning" is the
category.

### Powered-by partner bar — 10 logos

```
homepage hero (rendered):
Mantle Network · Z.ai · Anthropic · Google · Nansen · Elfa ·
Merchant Moe · Ondo Finance · Bybit · Pinata
```

**P2 finding**: 10 brand names in a row is a "we-are-not-yet-a-
real-company" tell. Industry pattern: ≤5 logos, the rest
relegated to a footer or "Powered by N+ partners" link. Cuts
visual noise on the hero AND lets the genuinely important ones
(Mantle, Bybit, Anthropic, Google) breathe.

---

## Findings — qualitative observations from rendered DOM

### Homepage `/`

✅ Hero copy is concrete and specific (DAO Treasury framing,
HEARTBEAT_SWAP carve-out).
✅ No decorative emoji in titles.
🟡 **The hero stats are `—` placeholders** because /api/health
   returned `OFFLINE` (cron lag at fetch time). This is honest
   per steering rule §1. But for the demo video we want to
   record while the agent IS live (LiveStatusBadge green).
🟡 **"Live Agent Pipeline" terminal** has a 14-line "Example
   pipeline lines" example clearly labelled. **Good honesty
   pattern, slightly verbose for a hero**. Could collapse to
   3-4 lines for the demo and explicitly link to /proof-
   explorer for the full reasoning.
🟡 **Risk Mascot shows `🔴 Offline`** in the same view as
   "Proof-of-Reasoning · The AI that proves why it didn't
   trade" — the contrast reads "the AI is dead". If demo
   recording happens while agent IS live, this should pulse
   green.

### `/replay`

✅ **This page is the strongest**. Visual hierarchy is clean:
   single H1, then 24 cycle cards, each with cycle ID + tier +
   timestamp + on-chain anchor pill. Anchor icons (⚓) are
   meaningful, not decoration. Tier filter not yet exposed
   but layout supports it.
✅ Manifests link to GitHub repo at the bottom — externalises
   the "audit folder is part of the submission" claim.

### `/discipline`

🔴 **Page returned an empty body in Tier 2 fetch** (server
   render issue OR SSR gating). When loaded interactively in
   the browser it works (operator confirmed in earlier
   sessions). For the demo: **verify it loads from a fresh
   incognito window before recording**. May need a
   loading-state polish or fallback content for the
   first-paint.

### `/backtest`

🔴 **Same empty-body issue.** Likely the Tier 2 renderer doesn't
   wait for client-side React + chart hydration. Same demo-day
   verification needed.

---

## P0 / P1 / P2 issue list

### P0 — surfaces the demo video MUST show correctly

| # | Surface | Issue | Fix |
|---|---|---|---|
| D-1 | `/discipline`, `/backtest` SSR | Empty initial render in Tier 2 fetch (may show blank flash to first-time visitors) | Add a server-side loading fallback OR verify SSR includes initial chart skeleton |
| D-2 | Homepage hero stats `—` while cron lag | Acceptable per honesty rule, but **bad demo backdrop**. | **Operator action**: record demo when LiveStatusBadge is green AND hero stats are populated (i.e. after a successful cycle) |
| D-3 | RiskMascot 🔴 Offline contradicts hero copy | Same root cause as D-2 | Same fix |

### P1 — drift fixes (≤30 min each)

| # | File | Issue | Fix |
|---|---|---|---|
| D-4 | global type scale | 17 distinct text sizes incl. `text-[8px]` | Define 8 named tokens in `globals.css` (`--text-xs` … `--text-3xl`) and refactor the 9 highest-frequency arbitrary brackets to nearest token |
| D-5 | global opacity scale | 13 distinct text-white opacity values | Define 4 tokens (`--text-primary` 0.95, `--text-secondary` 0.6, `--text-muted` 0.4, `--text-disabled` 0.2) AND consolidate 8 outliers to nearest |
| D-6 | partner bar | 10 logos on hero | Cut to 5 (Mantle, Bybit, Anthropic, Google, Pinata) and link "+5 more" to README |
| D-7 | "Live Agent Pipeline" terminal example | 14-line example block, labelled but visually heavy | Collapse to 4 most-relevant lines with link to `/proof-explorer` for full reasoning |

### P2 — polish backlog (post-demo if time allows)

| # | File | Issue | Fix |
|---|---|---|---|
| D-8 | `border-white/8`, `border-white/[0.05]`, `border-white/[0.03]`, `bg-white/[0.015]`, `bg-white/[0.06]`, `bg-white/[0.08]` (one-off values) | Cosmetic drift | Sed-batch to nearest established value |
| D-9 | Z-index tokens | Some hardcoded `z-50` and `z-[9999]` | Add `--z-toast`, `--z-modal` to globals; replace |
| D-10 | Hero gradient text "Proof-of-Reasoning" | Slight AI-slop signal (purple-to-green clip-text) | Acceptable; brand-consistent. Skip unless overhauling type system |

---

## 10 quick wins (≤30 min each)

These are the **highest ROI** before the demo video re-record.
I can ship them; some are ≤5 min.

1. **Reduce partner bar from 10 → 5 logos.** (D-6, ~10 min, high
   visual impact). Footer takes overflow.

2. **Collapse Live Agent Pipeline example block** from 14 to
   4 lines. (D-7, ~10 min, reduces hero scroll).

3. **Sed-batch one-off border opacity values** to nearest token.
   `border-white/8` → `border-white/10`,
   `border-white/[0.05]` → `border-white/[0.06]`,
   `border-white/[0.03]` → `border-white/[0.04]`. (D-8, ~5 min).

4. **Sed-batch one-off bg opacity values.**
   `bg-white/[0.015]` → `bg-white/[0.02]`,
   `bg-white/[0.06]` → `bg-white/[0.04]`,
   `bg-white/[0.08]` → `bg-white/5`. (D-8, ~5 min).

5. **Consolidate text opacity outliers** `/15`, `/25`, `/35`,
   `/55` to the nearest standard step (`/20`, `/30`, `/30`,
   `/60` respectively). (D-5, ~15 min, large file count but
   sed-friendly).

6. **Replace 9 arbitrary text-size brackets** (`text-[8px]`,
   `text-[12px]`, `text-[14px]`, `text-[24px]`, `text-[28px]`,
   `text-[36px]`) with the nearest standard size or add named
   tokens. (D-4, ~20 min).

7. **Add `--z-toast` and `--z-modal` tokens** to globals.css and
   replace 3 hardcoded `z-50`/`z-[9999]`. (D-9, ~5 min).

8. **Verify `/discipline` and `/backtest` render correctly in
   incognito** before demo recording. If they show blank flash,
   add an SSR skeleton matching the final layout. (D-1, ~15 min
   if fix needed).

9. **Add semantic CSS variables for the 4 main "live" colors**
   (green-active, yellow-idle, red-offline, blue-info) and
   remap the `text-green-400`, `text-red-400`, etc. to use
   them. Improves theming, not visual. (~20 min).

10. **Strip legacy comments** like `{/* QW-2: Radial gradient
    mesh behind hero */}` — these are useful in dev but signal
    "construction site" to a judge reading view-source.
    (~10 min).

Total: ~115 min for all 10. Realistic to ship 5-6 of them
before recording.

---

## Reference dashboard comparison

What Linear/Mercury/Stripe Atlas do that we don't:

| Pattern | Them | Us | Verdict |
|---|---|---|---|
| Hero copy | One bold zinger + supporting line | One zinger + 3-line subtitle + 5 stat boxes + skip link + partner bar + LIVE badge | Too much in one viewport. **D-7 fix helps** |
| Stat tiles | 3 large stats at most | 6 stats in a row + W/L pill + 3 hero stats above | Slight over-share. Leave for now |
| Type scale | 4-5 sizes, 1.25 ratio | 17 sizes incl. 9 arbitrary | **D-4 fix essential** |
| Color tokens | 3-5 brand + 4 semantic | 7 named, 13 opacity steps | **D-5 fix essential** |
| Animation | Sparing, on hero only | Multiple anim-fade-up + animate-pulse + float-gentle + arrow-animate | Probably acceptable for our "watch the agent reason live" theme. Don't reduce |
| Partner logos | 4-6, top of footer | 10, on hero | **D-6 fix** |
| Hero gradient text | Often single-color modern | purple→green clip-text | Brand-consistent; keep |

---

## What I deliberately did not check

- **WCAG color contrast** — needs axe-core or Lighthouse, both
  rate-limited from my environment. Safe assumption: text-white/30
  on bg-white/[0.02] over a near-black backdrop is borderline at
  small sizes. If we have time, run from the operator's machine.
- **Mobile rendering** — no mobile viewport simulation possible
  from this environment. Operator should record demo at 1440px
  desktop width regardless.
- **Animation jank** (60fps) — needs visual playback. Skip.
- **Loading-state polish** — `/discipline` and `/backtest`
  empty-body issue may be a fetch-mode artifact in Tier 2; need
  manual incognito verification.

---

## Recommendation for the demo video

Before recording, ship the **5 highest-ROI quick wins** (D-6,
D-7, D-8 batch, D-9, D-10 — ~50 min total). They visibly tighten
the hero. Skip the type-scale + opacity refactors (D-4, D-5)
unless a serious visual overhaul is on the table — those are
low-priority for the demo because Tailwind opacity differences
read identically at video resolution.

**Do NOT**:
- Replace the gradient text (brand consistency).
- Reduce animations (they're our differentiator, "watch it
  reason live").
- Cut the LiveStatusBadge / RiskMascot (they're our honesty
  signal).

**DO**:
- Cut partner bar to 5.
- Collapse hero terminal example.
- Sed-batch the one-off opacity values.
- Verify `/discipline` and `/backtest` render correctly in
  incognito.
- Record demo when LiveStatusBadge is GREEN (not OFFLINE).

If the operator wants me to ship the 5 quick wins as one batch,
say "go quick-wins" and I commit them in ~50 min. If you'd
rather do the type-scale refactor as well (~3h total), say
"go full polish".

---

## Shipped — 5 quick wins (2026-05-30)

Operator approved option (a) "go quick-wins" — landed all five
items in a single batch.

| # | ID | What landed | Files touched |
|---|---|---|---|
| 1 | D-6 | Partner bar trimmed 10 → 5 (Mantle, Anthropic, Google, Bybit, Pinata). Secondary 5 (Z.ai, Nansen, Elfa, Merchant Moe, Ondo) surfaced via "+5 more" inline link to README. | `frontend/app/page.tsx` (PARTNERS, SECONDARY_PARTNERS, partner-bar JSX) |
| 2 | D-7 | "Live Agent Pipeline" example collapsed 14 → 4 lines (regime, validator, decision, anchor). | `frontend/app/page.tsx` (REASONING_LINES) |
| 3 | D-8 | Sed-batch one-off opacity values to nearest token: `bg-white/[0.015]` → `[0.02]`, `bg-white/[0.06]` → `[0.04]`, `text-white/35` → `/30`, `border-white/[0.05]` → `border-white/5`, `border-white/[0.03]` → `[0.04]`, `border-white/8` → `border-white/10`, `hover:bg-white/[0.08]` → `hover:bg-white/5`. | `frontend/app/page.tsx`, `frontend/app/challenge/page.tsx`, `frontend/app/discipline/page.tsx`, `frontend/app/social/page.tsx`, `frontend/app/proof-explorer/client.tsx` |
| 4 | D-9 | Replaced hardcoded `z-[9999]` and `z-50` with `style={{ zIndex: "var(--z-toast)" }}` (token already defined in globals.css as `--z-toast: 60`). | `frontend/app/page.tsx` (toast), `frontend/app/components/RiskMascot.tsx` |
| 5 | D-10 | Stripped construction-trail `T14`/`T15` references from JSX-level `{/* */}` comments. Code-level `//` comments left as git-history culture trail. | `frontend/app/page.tsx` |

**Verification**

- `npx tsc --noEmit` — clean
- `npm run lint` (frontend scope) — 0 errors / 15 warnings (unchanged)
- `npx next build` — clean
- `npx jest --silent` — 276/276 passing across 19 suites
- `npx eslint src/ --max-warnings 50` — 0 errors / 48 warnings (unchanged; src/ untouched)

**Deferred to "full polish" pass (D-1 through D-5)**

Type-scale consolidation (17 → 8 sizes), opacity-scale tokens
(13 → 4), arbitrary-bracket sweep, `--space-*` adoption — all
need ~3h of careful refactor and full-page regression. Not
required pre-demo.

**Effect on demo video**

Hero is visibly tighter: 5 partner logos instead of 10, 4
reasoning lines instead of 14. Toast and risk mascot use
predictable z-stack tokens. No visible change to public copy
honesty (per `no-lying-about-state.md`) — pure presentation
polish.
