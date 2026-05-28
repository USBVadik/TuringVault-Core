# TuringVault Design Playbook

> Extracted from the live frontend (2025-06-14). Use this as the single source of truth for all UI work.

---

## 1. Type Scale

| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Display | 3xl–4xl (30–36px) | 700 (bold) | `tracking-tight` | Hero headlines |
| H1 | 2xl–3xl (24–30px) | 700 | `tracking-tight` | Page titles |
| H2 Section | xs (12px) | 700 | `tracking-[0.2em]` uppercase | Section headers |
| Body | sm (14px) | 400 | normal | Paragraphs, descriptions |
| Data | xs (12px) | 400–500 mono | normal | Table cells, stat labels |
| Caption | 10px | 600–700 | `tracking-widest` uppercase | Badges, micro-labels |
| Nano | 9px | 500 | `tracking-wider` uppercase | Sub-labels inside stat cards |

### Font Pairing

| Role | Font | Source | Variable |
|------|------|--------|----------|
| Sans (primary) | Space Grotesk | Google Fonts via `next/font` | `--font-space-grotesk` |
| Mono (data/code) | JetBrains Mono | Google Fonts via `next/font` | `--font-jetbrains-mono` |

**Rules:**
- All UI copy uses Space Grotesk
- All numeric data, code, addresses, timestamps use JetBrains Mono
- Never mix weights on the same line — one weight per text block
- Stat numbers: 36px/800wt with gradient clip (`stat-number` class)

---

## 2. Color Tokens

### Core Palette

```css
:root {
  /* Backgrounds */
  --vault-bg:           #030308;          /* Page background */
  --vault-surface:      rgba(10,10,20,0.7);  /* Card fill */
  --vault-glass:        rgba(14,14,28,0.5);  /* Glass overlay */
  --vault-glass-border: rgba(120,80,255,0.1); /* Glass card stroke */

  /* Brand */
  --purple-primary:     #7c3aed;          /* Interactive, accent */
  --purple-glow:        #a855f7;          /* Hover glow, highlights */
  --purple-deep:        #4c1d95;          /* Deep/shadow purple */

  /* Success */
  --green-primary:      #10b981;          /* Positive, live, approved */
  --green-glow:         #34d399;          /* Green highlights */

  /* Text (white-on-dark) */
  --text-primary:       rgba(255,255,255,0.95);  /* Body text */
  --text-secondary:     rgba(255,255,255,0.6);   /* Secondary info */
  --text-muted:         rgba(255,255,255,0.3);   /* Hints, placeholders */

  /* Borders */
  --border-subtle:      rgba(255,255,255,0.06);  /* Dividers */
  --border-accent:      rgba(124,58,237,0.25);   /* Purple accent lines */
}
```

### Semantic Colors (Tailwind classes)

| Meaning | Text | Background | Border |
|---------|------|------------|--------|
| Positive/Success | `text-green-400` | `bg-green-500/[0.03]` | `border-green-500/30` |
| Negative/Blocked | `text-red-400` | `bg-red-500/[0.03]` | `border-red-500/30` |
| Warning/Caution | `text-yellow-300/80` | `bg-yellow-400/[0.04]` | `border-yellow-400/10` |
| Info/Neutral | `text-white/60` | `bg-white/[0.02]` | `border-white/[0.06]` |
| Brand/Interactive | `text-purple-300` | `bg-purple-500/10` | `border-purple-500/20` |

### Gradient Tokens

| Name | Value | Usage |
|------|-------|-------|
| Hero gradient | `from-purple-400 to-green-400` | Hero headline text |
| Stat gradient | `135deg, #fff 20%, rgba(168,85,247,0.9) 80%` | stat-number fill |
| Stat green | `135deg, #fff 20%, rgba(52,211,153,0.9) 80%` | stat-number-green fill |
| Button primary | `135deg, var(--purple-primary), #6d28d9` | Primary CTA |
| Button green | `135deg, #059669, #10b981` | Positive action CTA |
| Card surface | `145deg, rgba(14,14,28,0.6) 0%, rgba(8,8,16,0.8) 100%` | glass-card |
| Hero surface | `145deg, rgba(20,12,40,0.7) 0%, rgba(6,6,14,0.9) 100%` | glass-hero |

---

## 3. Spacing Scale

> **Current state:** No formal scale. Below is the recommended 4px-base scale extracted from usage patterns.

| Token | Value | Usage examples |
|-------|-------|---------------|
| `space-1` | 4px | Icon-to-text gap, inner badge padding |
| `space-2` | 8px | Tight card internal padding, small gaps |
| `space-3` | 12px | Input padding, button padding-y, card internal sections |
| `space-4` | 16px | Standard card padding, terminal body padding |
| `space-5` | 20px | Card padding (glass-card p-5) |
| `space-6` | 24px | Section internal padding (p-6) |
| `space-8` | 32px | Page-level section margins (py-8) |
| `space-10` | 40px | Hero internal padding, partner-bar gap |
| `space-12` | 48px | Large section gaps |

### Layout Constraints

| Token | Value | Usage |
|-------|-------|-------|
| `max-w-page` | 1200px | Standard page content width |
| `nav-height` | 56px (h-14) | Fixed navbar height |
| `content-offset` | 56px (pt-14) | Content top padding below nav |

---

## 4. Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `motion-enter` | 0.7s | `cubic-bezier(0.16, 1, 0.3, 1)` | Page section fade-up entry |
| `motion-hover` | 0.2s | `ease` | Button/card hover transitions |
| `motion-press` | 0.1s | `ease` | Button active/press |
| `motion-glow` | 0.3s | `ease` | Border glow on hover |
| `motion-float` | 6s | `ease-in-out` infinite | Gentle floating elements |
| `motion-pulse` | 2s | `ease-in-out` infinite | Live dot, badge pulse |
| `motion-spin` | 6–10s | `linear` infinite | AI brain rings |
| `motion-scan` | 4s | `linear` infinite | Scan-line decorative |
| `motion-shimmer` | 1.5s | `ease-in-out` infinite | Skeleton loading shimmer |

### Stagger Pattern

```css
.anim-delay-1 { animation-delay: 0.05s; }
.anim-delay-2 { animation-delay: 0.10s; }
.anim-delay-3 { animation-delay: 0.15s; }
/* ... increments of 50ms ... */
.anim-delay-7 { animation-delay: 0.35s; }
```

### Reduced Motion

> **Not yet implemented.** Should add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. Component States Standard

### Buttons

| State | Visual |
|-------|--------|
| Default | Gradient fill, 12px radius, font-600 |
| Hover | translateY(-1px), box-shadow glow (30–40px spread), gradient overlay at 10% white |
| Active/Press | scale(0.97) |
| Disabled | opacity 0.3, cursor not-allowed, no transform, no shadow |
| Focus-visible | 2px gap ring (vault-bg color) + 4px purple ring |

### Cards (glass-card)

| State | Visual |
|-------|--------|
| Default | Glass gradient fill, 1px glass-border, 16px radius |
| Hover | Border brightens to `rgba(124,58,237,0.2)`, translateY(-2px), box-shadow 20px/60px, gradient border overlay fades in |
| Active | N/A (cards are not clickable by default) |
| Loading | skeleton-shimmer class applied to placeholder blocks |

### Inputs

| State | Visual |
|-------|--------|
| Default | Dark fill (`rgba(8,8,16,0.8)`), 1px border at `rgba(255,255,255,0.08)`, 10px radius |
| Focus | Border → purple-primary, 3px outer glow ring at 10% purple, 20px inner glow |
| Placeholder | text-muted color |
| Error | Not formally defined — **should add red border + error message** |

### Badges

| Variant | Visual |
|---------|--------|
| Live (green) | Pill shape, green bg at 8%, green border at 25%, pulsing green dot, 10px uppercase bold |
| Network | Same as live but in navbar |
| Mode (LIVE_MULTI_AGENT) | Emerald bg/border, pulsing dot, mono uppercase |
| Mode (PREVIEW) | Yellow bg/border, static dot, mono uppercase |

### Tables

| State | Visual |
|-------|--------|
| Header | Dark bg (`rgba(14,14,28,0.8)`), 10px uppercase letter-spaced labels, bottom border |
| Row default | 14px padding, subtle bottom border |
| Row hover | Purple bg at 3% opacity |
| Row expanded | Lighter bg (white/[0.01]), full-width detail panel |

### Stat Cards

| State | Visual |
|-------|--------|
| Default | Rounded-lg, subtle border (white/[0.04]), bg at white/[0.02] |
| Hover (interactive) | bg brightens to white/[0.04], border to purple/0.15 |
| Loading | Skeleton shimmer rectangles matching final size |

---

## 6. Accessibility Notes

### Current Implementation
- `focus-ring` utility with focus-visible ring (purple)
- `role="note"` + `aria-live="polite"` on demo-mode banner
- `role="alert"` on stale-data warning
- `title` attributes on stat cards explaining data source
- Semantic HTML (nav, main, header, section)

### Gaps to Address
- No `prefers-reduced-motion` media query
- No skip-to-content link
- Color contrast on `text-white/30` against `#030308` is ~1.5:1 (fails WCAG AA for all sizes)
- Interactive elements in tables lack explicit `role="button"` or keyboard handlers
- Chart (SVG equity curve) has no accessible alternative text

---

## 7. Responsive Breakpoints

| Breakpoint | Current Usage |
|------------|--------------|
| `md` (768px) | Homepage stat-number shrinks to 28px, partner-bar wraps, brain shrinks |
| — | Sub-pages have **no** responsive rules defined |

### Recommended Additions
```
sm (640px): Stack all grids to 1-col
md (768px): 2-col grids where applicable
lg (1024px): Full layout (3-col terminal grid)
```

---

## 8. File Organization

```
frontend/app/
├── globals.css          ← All design tokens, component classes, animations
├── layout.tsx           ← Font loading, metadata, providers, navbar
├── page.tsx             ← Homepage
├── components/
│   ├── Navbar.tsx       ← Fixed top nav
│   ├── LiveTerminal.tsx ← Terminal widget
│   ├── VerifyButton.tsx ← On-chain verify interaction
│   ├── RiskMascot.tsx   ← Risk indicator character
│   ├── Skeleton.tsx     ← Loading skeletons
│   ├── StatusBadge.tsx  ← Generic status badge
│   ├── SectionHeader.tsx
│   └── FundButton.tsx
├── proof-explorer/
│   ├── animations.css   ← Page-specific motion tokens
│   ├── client.tsx       ← Client component
│   ├── layout.tsx       ← Sub-layout
│   └── page.tsx         ← Server component entry
└── [other pages]/page.tsx
```
