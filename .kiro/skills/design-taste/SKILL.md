---
name: design-taste
description: Design-engineering taste for frontend review and UI polish — animation timing, easing, spacing rhythm, anti-slop discipline. Activate before reviewing or building any frontend UI in this project.
inclusion: manual
---

# Design Taste (Kiro-native)

A distilled design-engineering rubric for reviewing and polishing the
TuringVault frontend. Use it when the operator asks to review a page,
polish UI, judge "does this look premium", or audit for AI-slop.

> **Provenance.** This skill is a Kiro-native distillation of three
> public, openly-licensed design skills, rephrased in my own words
> for compliance with their licensing:
> - **Emil Kowalski's `emil-design-eng`** (animation/motion craft,
>   author of Sonner + Vaul, Linear web team) — github.com/emilkowalski/skill
> - **`taste-skill` by Leon Lin** (MIT) — anti-slop frontend rubric —
>   github.com/Leonxlnx/taste-skill
> - **`impeccable` by pbakaus** — design vocabulary + audit protocol —
>   impeccable.style
> Content was rephrased for compliance with licensing restrictions.
> For the full original guidance, see those sources directly.

---

## Core stance

Taste is a trained instinct, not personal preference: the ability to
notice what makes an interface feel right and what makes it feel
templated. In a market where every product "works", craft is the
differentiator. Most polish is invisible individually but compounds in
aggregate. Review the live rendered page, not just the JSX.

When two implementations are functionally equal, prefer the one with:
fewer arbitrary values, tighter motion, clearer hierarchy, calmer color.

---

## Review output format (required)

When reviewing UI code, output a markdown table with these columns:

| Surface | Current | Suggested | Why |
|---|---|---|---|

One row per issue. The "Why" column states the reasoning in one line.
Do not use prose paragraphs with "Before:" / "After:" on separate
lines — use the table. Order rows by impact (motion/hierarchy first,
cosmetic last).

---

## Animation decision framework

Answer in order before writing or approving any animation.

### 1. Should it animate at all?

Gate on frequency of exposure:
- Seen 100+ times/day (keyboard shortcuts, command palette): **no
  animation, ever.** Animation makes a repeated action feel slow.
- Seen tens of times/day (hover, list nav): minimal or none.
- Occasional (modals, drawers, toasts): standard animation.
- Rare / first-time (onboarding, celebrations): delight is allowed.

Never animate a keyboard-initiated action.

### 2. What is the purpose?

Every animation needs a reason beyond "looks cool":
- spatial consistency (enter/exit from the same edge)
- state indication (a control morphs to show a state change)
- feedback (a press is acknowledged)
- preventing jarring pop-in/out
If the only reason is decoration AND the user sees it often, drop it.

### 3. Easing

- Entering or exiting → **ease-out** (fast start = feels responsive)
- Moving / morphing on screen → ease-in-out
- Hover / color → ease
- Constant motion (marquee, progress) → linear
- **Never ease-in for UI.** It delays the first frame — the exact
  moment the user is watching — and feels sluggish even at the same
  duration.
- Built-in CSS easings are too weak. Use stronger custom curves:
  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  ```

### 4. Duration

- Button press feedback: 100-160ms
- Tooltips / small popovers: 125-200ms
- Dropdowns / selects: 150-250ms
- Modals / drawers: 200-500ms
- **UI animations stay under 300ms.** A 180ms dropdown feels snappier
  than a 400ms one. Perceived speed matters as much as real speed.

---

## Component craft rules

- **Pressables get `:active` feedback.** `transform: scale(0.97)` with
  a ~160ms ease-out transition. Subtle (0.95–0.98). Makes the UI feel
  like it heard the click.
- **Never animate from `scale(0)`.** Nothing in reality appears from
  nothing. Start at `scale(0.95)` + `opacity: 0`.
- **Popovers scale from their trigger,** not center
  (`transform-origin`). Exception: modals stay centered (they aren't
  anchored to a trigger).
- **Transitions over keyframes for interruptible UI.** Transitions
  retarget mid-flight; keyframes restart from zero. Use transitions
  for anything triggered rapidly (toasts, toggles).
- **Asymmetric enter/exit.** Slow where the user deliberates, fast
  where the system responds (e.g. hold-to-delete 2s, release 200ms).
- **Stagger list entrances** 30–80ms apart. Longer feels slow. Never
  block interaction while staggering.
- **Reduced motion:** under `prefers-reduced-motion`, keep opacity/
  color transitions that aid comprehension; drop positional motion.
- **Gate hover effects** behind `@media (hover: hover) and (pointer:
  fine)` so touch taps don't trigger false hovers.

---

## Performance rules

- Animate **only `transform` and `opacity`** (GPU, skips layout +
  paint). Avoid animating width/height/margin/padding/top/left.
- Prefer `translateY(100%)` (percent of own size) over hardcoded px.
- In Framer Motion, the `x`/`y`/`scale` shorthands are NOT hardware-
  accelerated under load — use the full `transform` string for
  anything that must stay smooth while the page is busy.
- CSS animations run off the main thread; JS rAF animations drop
  frames during page loads. Use CSS for predetermined motion, JS only
  for dynamic/interruptible.

---

## Anti-slop discipline (the "taste" gate)

AI-generated UI has tells. Flag these on review:

- **Token drift.** Many near-duplicate values (13 opacity steps, 17
  text sizes) instead of a small scale. Consolidate to a system.
- **Generic gradients / clip-text everywhere.** One brand accent is
  fine; rainbow purple→green on every heading is slop.
- **`transition: all`.** Always name the exact properties.
- **Emoji as decoration.** Semantic/functional emoji OK; decorative
  emoji headers are a slop tell. Prefer an icon set (we use lucide).
- **Pretentious copy.** "Revolutionary", "seamless", "unleash",
  "elevate" with no concrete claim. Our copy is concrete + technical.
- **Em-dash overuse in generated copy.** Tighten.
- **Centered-everything layout** with no rhythm. Vary alignment and
  spacing intentionally; use a spacing scale, not arbitrary px.
- **Filler placeholder comments** left in shipped JSX.

A page passes the taste gate when: the type scale is small and
consistent, color has ≤4 text-opacity steps, motion follows the
framework above, copy is concrete, and nothing is animated that a
user sees hundreds of times a day.

---

## Three dials to read from the brief

Infer these from context rather than asking, then state your read:
- **Variance** — centered/clean ↔ asymmetric/experimental.
- **Motion** — hover-only ↔ scroll-driven/magnetic.
- **Density** — spacious/editorial ↔ dense dashboard.

TuringVault default: **low variance, low-to-medium motion, medium
density.** It's a serious on-chain RWA agent, not a playful consumer
toy. Crisp and fast over bouncy. The "watch the agent reason live"
theme justifies the existing anim-fade-up / pulse on hero, but new
motion must earn its place per the framework above.

---

## Project-specific context

- Stack: Next.js + Tailwind, dark theme (`bg-[#0a0a0f]`), lucide icons.
- Design tokens live in `frontend/app/globals.css` (`--space-*`,
  `--z-*`, easing vars if present). Prefer tokens over arbitrary
  bracket values.
- Audit 30 (`.kiro/audits/30-design-slop-audit.md`) is the standing
  inventory of drift (text sizes, opacity, partner logos). Reference
  it; don't re-derive.
- Honesty rule (`.kiro/steering/no-lying-about-state.md`) outranks
  aesthetics: never polish a label into claiming state it doesn't have.

---

## When invoked for a review

1. Inventory the live surface (rendered page), not just the source.
2. Run the anti-slop gate + animation framework against it.
3. Output the `Surface | Current | Suggested | Why` table, impact-
   ordered.
4. Separate "ship now" (quick wins) from "needs a refactor pass".
5. Never claim a visual change is shipped until tsc + lint + build
   pass and it's committed.
