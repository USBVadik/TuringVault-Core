# Audit 32 — Design System Spec (type scale + opacity + motion tokens)

**Date**: 2026-06-01
**Skill**: `.kiro/skills/design-taste` (Emil Kowalski motion craft +
taste-skill anti-slop + impeccable vocabulary, distilled Kiro-native)
**Relationship to audit 30**: Audit 30 inventoried the drift and
shipped 5 quick wins (D-6..D-10). This audit is the **system the
deferred D-1..D-5 refactor migrates to** — it converts "consolidate
someday" into a mechanical find-and-replace with an exact mapping
table.

**Coordination note**: The operator's other agent is concurrently
editing `globals.css` (transition:all, hover-gate) and `page.tsx`
(H1 staleness, H2 locale, tabular-nums). This spec lives in `.kiro/`
and touches NO source files, so it cannot conflict. It is the plan
the second design pass executes AFTER those ship.

---

## 1. Current state (measured, not estimated)

Counts from `grep` over `frontend/app/**/*.tsx` on 2026-06-01.

### Text sizes — 10 distinct (target: 6)

```
123  text-[10px]      ← dominant; "shrunk-to-fit" smell
 52  text-[9px]
 42  text-xs   (12px)
 31  text-sm   (14px)
 24  text-[11px]
 13  text-lg   (18px)
  9  text-[8px]       ← unreadable at distance; slop tell
  8  text-xl   (20px)
  4  text-[12px]      ← duplicate of text-xs
  3  text-[14px]      ← duplicate of text-sm
```

Plus hero/section headings (`text-2xl/3xl/4xl` and `text-[24/28/36px]`)
used sparingly in `page.tsx` — those are fine, they're the display tier.

**Smell**: 5 arbitrary-bracket values (`[8px] [9px] [10px] [11px]
[12px] [14px]`) where `[12px]==xs` and `[14px]==sm` are literal
duplicates of Tailwind tokens. `[8px]` should not exist on a
dashboard a judge reads on a laptop.

### Text opacity — 12 distinct (target: 4 + full)

```
 79  text-white/30
 50  text-white/40
 25  text-white/50
 22  text-white/70
 20  text-white/20
 15  text-white/25
 12  text-white/60
  9  text-white/90
  7  text-white/80
  5  text-white/55     ← one-off
  3  text-white/15     ← one-off
  3  text-white/10
```

**Smell**: `/55`, `/15`, `/25` are near-duplicates of `/50`, `/20`,
`/30`. Four functional levels are doing the work of twelve.

### Motion — no easing tokens

`globals.css` uses bare `ease` / `ease-in-out` / `linear` everywhere
plus one good custom curve (`cubic-bezier(0.16,1,0.3,1)` on
`.anim-fade-up`). No `--ease-*` variables. Per skill: built-in CSS
easings are too weak for UI; enter/exit should use a strong ease-out.

---

## 2. Target system

### 2.1 Type scale — 6 steps (1.25 ratio, anchored at 16px base)

| Token | px | Tailwind | Role | Replaces |
|---|---|---|---|---|
| `--text-2xs` | 10 | `text-[10px]` keep as token | dense mono labels, tape rows | `[8px]`, `[9px]`, `[10px]` |
| `--text-xs` | 12 | `text-xs` | secondary labels, captions | `[11px]`, `[12px]` |
| `--text-sm` | 14 | `text-sm` | body, table cells | `[14px]` |
| `--text-base` | 16 | `text-base` | primary body | — |
| `--text-lg` | 20 | `text-xl` | sub-headings, stat values | `text-lg` (18→20) |
| `--text-display` | 28–36 | `text-3xl/4xl` | hero + section H1 | keep |

**Collapse rules:**
- `text-[8px]` → `text-[10px]` (nothing below 10px on this product)
- `text-[9px]` → `text-[10px]`
- `text-[11px]` → `text-xs`
- `text-[12px]` → `text-xs`
- `text-[14px]` → `text-sm`
- `text-lg` → `text-xl` (drop the 18px step; 14→20 is a cleaner jump)

Net: 10 → 6 steps. The two literal duplicates (`[12px]`, `[14px]`)
vanish for free.

### 2.2 Opacity scale — 4 named levels

Already half-defined in `:root` (`--text-primary/secondary/muted`).
Extend to a strict 4-rung ladder and map Tailwind alphas onto it:

| Token | alpha | Tailwind | Role |
|---|---|---|---|
| `--text-primary` | 0.95 | `text-white/90` | headings, key values |
| `--text-secondary` | 0.68 | `text-white/70` | body, active labels |
| `--text-muted` | 0.42 | `text-white/40` | captions, secondary |
| `--text-faint` | 0.22 | `text-white/20` | timestamps, hints, disabled |

**Collapse map (12 → 4):**
```
/90 /80          → /90   (primary)
/70 /60 /55      → /70   (secondary)
/50 /40          → /40   (muted)
/30 /25          → /40 if it's a label, /20 if it's a hint*
/20 /15 /10      → /20   (faint)
```
\* `/30` is the single most-used (79×). Most are muted labels →
`/40`. A handful are decorative hints → `/20`. This is the only rung
needing per-call judgement; the rest are pure substitution.

### 2.3 Motion tokens (add to `:root`)

```css
/* Strong UI easings — built-ins are too weak (design-taste skill) */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);     /* enter/exit */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* on-screen move */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);  /* drawer/sheet */

/* Durations — UI stays < 300ms */
--dur-press: 140ms;    /* button :active feedback */
--dur-fast: 180ms;     /* tooltips, small popovers */
--dur-base: 240ms;     /* dropdowns, selects */
--dur-slow: 300ms;     /* modals, drawers (ceiling for UI) */
```

`.anim-fade-up` already uses a near-identical curve — keep it, it's
correct. New transitions should reference these vars instead of bare
`ease`.

---

## 3. Migration plan (the deferred D-1..D-5, now mechanical)

Sequenced so each step is independently shippable and verifiable.

**Step A — add tokens (additive, zero visual change).**
Add §2.1 + §2.3 vars to `:root` in `globals.css`. Nothing references
them yet. Safe to ship alone. tsc/lint/build still green.

**Step B — opacity sweep (12 → 4).**
sed-batch the pure substitutions first:
```
text-white/80 → text-white/90
text-white/60 → text-white/70
text-white/55 → text-white/70
text-white/50 → text-white/40
text-white/25 → text-white/40
text-white/15 → text-white/20
text-white/10 → text-white/20
```
Then hand-review the 79 `/30` occurrences (label → /40, hint → /20).
This is the only step needing eyes. Diff page-by-page.

**Step C — type sweep (10 → 6).**
sed-batch the duplicates + sub-10px:
```
text-[8px]  → text-[10px]
text-[9px]  → text-[10px]
text-[11px] → text-xs
text-[12px] → text-xs
text-[14px] → text-sm
text-lg     → text-xl
```
Pure substitution, no judgement. Verify hero headings untouched.

**Step D — motion adoption (optional, lower ROI).**
Replace bare `ease` on enter/exit transitions with `var(--ease-out)`.
Gate hover effects behind `@media (hover:hover)`. NOTE: the other
agent is already doing the hover-gate + transition:all fixes — DO NOT
double-edit; pick this up only for the easing-var swap after they
land.

**Step E — perf pass (separate, post-demo).**
Wrap the always-running keyframes (`brainSpin`, `proofScan`,
`signalDraw`, `signalScanline`, `signalSweep`, `orbFloat`) so they
pause off-viewport via `IntersectionObserver` or
`animation-play-state`. Battery + CPU; not a blocker.

---

## 4. Risk + ordering

- Steps A–C are safe to do before the demo IF there's time; each is
  one commit, fully reversible, verifiable with build + a visual diff.
- If time is tight: **ship nothing from this audit before the demo.**
  The 5 quick wins (audit 30) + the operator-agent's H1/H2/transition
  fixes already remove the worst visible drift. This system is the
  "do it right" pass for after the submission freeze, OR a calm
  evening if the demo re-record slips.
- The spec's value is that it exists: when we DO the refactor, it's a
  30-minute mechanical sweep against a table, not a 3-hour
  re-derivation.

## 5. Honesty / scope guard

This audit changes the LOOK, never the DATA. No stat, badge, label,
or freshness signal changes meaning. `no-lying-about-state.md` is not
engaged by any step here. (H1 staleness + H2 locale are the
operator-agent's honesty fixes, tracked separately — this spec
deliberately does not touch them to avoid collision.)
