# Design Enhancement — Technical Design

## Overview

Этот документ описывает техническую реализацию улучшений дизайна TuringVault для достижения уровня топовых DeFi/AI продуктов.

---

## 1. Icon System (R1)

### 1.1 Emoji → Lucide Mapping

```typescript
// frontend/app/lib/icons.ts
import {
  TrendingUp, // 📈 Performance/Growth
  AlertCircle, // 🔴 Error/Danger
  CheckCircle, // 🟢 Success/Active
  Link, // ⛓️ Chain/Blockchain
  Zap, // ⚡ Fast/Live/Energy
  Shield, // 🛡️ Security/Protection
  Skull, // 💀 Danger/Attack
  BarChart3, // 📊 Charts/Analytics
  Rocket, // 🚀 Launch/Pump
  Eye, // 🔮 Oracle/Vision
  Bot, // 🤖 AI/Robot
  Swords, // ⚔️ Challenge/Battle
  GitBranch, // Evolution/Versioning
  Activity, // Live activity
  Brain, // AI/Intelligence
  Wallet, // Wallet/Funds
  ExternalLink, // External links
  Terminal, // Terminal/Console
  Cpu, // Processing/Compute
} from "lucide-react";

export const ICON_MAP = {
  performance: TrendingUp,
  error: AlertCircle,
  success: CheckCircle,
  chain: Link,
  live: Zap,
  security: Shield,
  danger: Skull,
  analytics: BarChart3,
  pump: Rocket,
  oracle: Eye,
  bot: Bot,
  challenge: Swords,
  evolution: GitBranch,
  activity: Activity,
  brain: Brain,
  wallet: Wallet,
  external: ExternalLink,
  terminal: Terminal,
  compute: Cpu,
} as const;
```

### 1.2 Section Header Component

```typescript
// frontend/app/components/SectionHeader.tsx
import { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  iconColor?: string; // Tailwind color class
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  iconColor = "text-purple-400",
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">
        {title}
      </h2>
      {subtitle && (
        <span className="text-[10px] font-mono text-white/30">{subtitle}</span>
      )}
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}
```

### 1.3 Files to Update

| File                  | Emoji | Replace With      |
| --------------------- | ----- | ----------------- |
| `page.tsx`            | `📈`  | `<TrendingUp />`  |
| `page.tsx`            | `🔴`  | `<AlertCircle />` |
| `page.tsx`            | `🟢`  | `<CheckCircle />` |
| `page.tsx`            | `⛓️`  | `<Link />`        |
| `page.tsx`            | `⚡`  | `<Zap />`         |
| `challenge/page.tsx`  | `⚔️`  | `<Swords />`      |
| `challenge/page.tsx`  | `🛡️`  | `<Shield />`      |
| `challenge/page.tsx`  | `💀`  | `<Skull />`       |
| `challenge/page.tsx`  | `⚡`  | `<Zap />`         |
| `challenge/page.tsx`  | `🚀`  | `<Rocket />`      |
| `challenge/page.tsx`  | `🔮`  | `<Eye />`         |
| `challenge/page.tsx`  | `🤖`  | `<Bot />`         |
| `backtest/page.tsx`   | `📊`  | `<BarChart3 />`   |
| `discipline/page.tsx` | `🛡️`  | `<Shield />`      |

---

## 2. Global Layout (R2)

### 2.1 Updated Layout Structure

```typescript
// frontend/app/layout.tsx
import Navbar from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <div className="pt-14">
            {" "}
            {/* Offset for fixed navbar */}
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

### 2.2 Enhanced Navbar

```typescript
// frontend/app/components/Navbar.tsx — additions
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/challenge", label: "Challenge", icon: Swords },
  { href: "/backtest", label: "Performance", icon: TrendingUp },
  { href: "/proof-explorer", label: "Proofs", icon: Shield },
  { href: "/discipline", label: "Discipline", icon: Activity }, // NEW
  { href: "/social", label: "Social", icon: MessageCircle }, // NEW
];
```

### 2.3 Remove Back Links

Удалить из всех внутренних страниц:

```tsx
// REMOVE THIS PATTERN:
<a href="/" className="text-xs text-white/30 hover:text-white/60 mb-4 block">
  ← Back to Dashboard
</a>
```

---

## 3. Page Structure (R3)

### 3.1 Page Wrapper Component

```typescript
// frontend/app/components/PageWrapper.tsx
interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}

export function PageWrapper({
  children,
  title,
  description,
  icon: Icon,
  badge,
}: PageWrapperProps) {
  return (
    <main className="relative min-h-screen px-6 py-8 max-w-[1200px] mx-auto">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          {Icon && <Icon className="w-6 h-6 text-purple-400" />}
          <h1 className="text-3xl font-bold">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-white/40 text-sm max-w-2xl">{description}</p>
        )}
      </header>
      {children}
    </main>
  );
}
```

---

## 4. Loading States (R4)

### 4.1 Skeleton Component

```typescript
// frontend/app/components/Skeleton.tsx
interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className = "", variant = "text" }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-white/5";
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
}

// Preset skeletons
export function SkeletonCard() {
  return (
    <div className="glass-card p-6 space-y-4">
      <Skeleton className="w-1/3 h-3" />
      <Skeleton className="w-full h-8" />
      <Skeleton className="w-2/3 h-3" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <div
      className="table-v2-row"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3" />
      ))}
    </div>
  );
}
```

---

## 5. Status Badge Component (R8)

### 5.1 Unified StatusBadge

```typescript
// frontend/app/components/StatusBadge.tsx
type BadgeVariant =
  | "live"
  | "idle"
  | "offline"
  | "success"
  | "error"
  | "warning"
  | "info";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  pulse?: boolean;
  tooltip?: string;
}

const VARIANTS: Record<
  BadgeVariant,
  { bg: string; text: string; dot: string }
> = {
  live: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  idle: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  offline: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  error: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

export function StatusBadge({
  variant,
  label,
  pulse = false,
  tooltip,
}: StatusBadgeProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-current/20 ${v.bg} ${v.text} text-[10px] font-mono uppercase tracking-wider`}
      title={tooltip}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${v.dot} ${
          pulse ? "animate-pulse" : ""
        }`}
      />
      {label}
    </span>
  );
}
```

---

## 6. CSS Additions (globals.css)

```css
/* ══════ MICRO-INTERACTIONS ══════ */
.btn-press:active {
  transform: scale(0.98);
}

.link-hover {
  position: relative;
}

.link-hover::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transition: width 0.2s ease;
}

.link-hover:hover::after {
  width: 100%;
}

/* ══════ SKELETON ANIMATION ══════ */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* ══════ FOCUS STATES ══════ */
.focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--purple-primary), 0 0 0 4px rgba(124, 58, 237, 0.2);
}
```

---

## 7. File Changes Summary

| File                           | Changes                                          |
| ------------------------------ | ------------------------------------------------ |
| `layout.tsx`                   | Add Navbar import, wrap children with pt-14      |
| `page.tsx`                     | Replace emoji with icons, use SectionHeader      |
| `challenge/page.tsx`           | Replace emoji, remove back link                  |
| `backtest/page.tsx`            | Replace emoji, remove back link, add PageWrapper |
| `proof-explorer/page.tsx`      | Remove back link                                 |
| `discipline/page.tsx`          | Replace emoji, remove back link                  |
| `social/page.tsx`              | Remove back link                                 |
| `components/Navbar.tsx`        | Add Discipline, Social links                     |
| `components/SectionHeader.tsx` | NEW                                              |
| `components/PageWrapper.tsx`   | NEW                                              |
| `components/Skeleton.tsx`      | NEW                                              |
| `components/StatusBadge.tsx`   | NEW                                              |
| `lib/icons.ts`                 | NEW                                              |
| `globals.css`                  | Add micro-interactions, skeleton, focus states   |

---

## 8. Dependencies

**Existing (no changes)**:

- `lucide-react` — already installed
- `tailwindcss` — already installed

**No new dependencies required** — все улучшения реализуются с существующим стеком.

---

## 9. Testing Checklist

- [ ] Navbar visible on all pages
- [ ] No emoji in production UI
- [ ] Skeleton states appear during loading
- [ ] Hover states work on all interactive elements
- [ ] Focus states visible for keyboard navigation
- [ ] Mobile responsive (basic check)
- [ ] No console errors
- [ ] All links work correctly
