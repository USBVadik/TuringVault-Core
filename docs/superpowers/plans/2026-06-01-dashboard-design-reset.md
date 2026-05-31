# Dashboard Design Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the TuringVault main dashboard into a calmer operator-grade live agent dashboard while preserving existing data behavior.

**Architecture:** Keep the existing Next.js page and API calls. Change only presentation: global design tokens/classes in `frontend/app/globals.css` and the main dashboard composition in `frontend/app/page.tsx`. Do not touch execution, API, wallet, or smart-contract logic.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, lucide-react, RainbowKit.

---

### Task 1: Baseline and Reversible Branch

**Files:**
- Create: `docs/superpowers/specs/2026-06-01-dashboard-design-reset.md`
- Create: `docs/superpowers/plans/2026-06-01-dashboard-design-reset.md`

- [x] **Step 1: Create branch**

Run:

```bash
git switch -c codex/design-reset-dashboard
```

Expected: branch exists and `main` remains the fallback.

- [x] **Step 2: Capture current production screenshot**

Open `https://frontend-seven-beta-46.vercel.app/` and capture the first viewport before edits.

- [x] **Step 3: Save design spec**

Save the design reset intent to `docs/superpowers/specs/2026-06-01-dashboard-design-reset.md`.

### Task 2: Calm the Global Visual System

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Replace neon theme tokens**

Change root tokens to neutral graphite surfaces with restrained semantic accents. Keep CSS variable names where possible so existing components continue to render.

- [ ] **Step 2: Disable decorative orbs/mesh**

Keep class names but make `.orb-bg`, `.orb`, `.hero-mesh-bg`, and heavy glow effects visually inert or subtle. This avoids editing every component that references them.

- [ ] **Step 3: Flatten cards**

Update `.glass-card` and `.glass-hero` to use 8px radius, subtle borders, no hover lift, no gradient halo, and no heavy backdrop blur.

### Task 3: Recompose the Main First Viewport

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace hero-led ordering**

Move the first viewport toward an operations layout:

- top strip: network, wallet connect, demo mode;
- primary grid: live agent status, latest decision feed, wallet/NAV summary;
- proof/reputation metrics below the primary operational state.

- [ ] **Step 2: Reduce marketing density**

Keep Proof-of-Reasoning and partner provenance, but make them supporting elements rather than the main hero.

- [ ] **Step 3: Preserve data integrity**

Do not change existing fetch hooks, health checks, performance data, decision tiers, wallet data, or proof links.

### Task 4: Verify Locally

**Files:**
- Read-only verification of frontend.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint --prefix frontend
```

Expected: no new errors. Existing warnings are acceptable if unchanged.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build --prefix frontend
```

Expected: production build succeeds.

- [ ] **Step 3: Visual inspect**

Run the local frontend and inspect desktop/mobile first viewport screenshots. Confirm no text overlaps, no blank panels, and live status still renders truthfully.

### Task 5: Decide Keep or Revert

**Files:**
- No code required.

- [ ] **Step 1: Compare against baseline**

Compare screenshots against the production baseline.

- [ ] **Step 2: Keep branch only if clearer**

If the redesign is weaker, discard the branch. If it is stronger, commit and push the branch for review.
