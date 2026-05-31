# TuringVault Dashboard Design Reset

Date: 2026-06-01
Branch: codex/design-reset-dashboard

## Goal

Make the public dashboard feel like a serious live agent control surface, not a crypto landing page or AI-generated showcase.

The current production design remains available on `main` as the fallback. This branch is an experiment that can be discarded if the result is weaker.

## Direction

Use an operator-grade fintech/security dashboard style:

- Dense but calm information layout.
- Clear live system status above marketing copy.
- Restrained color palette with semantic accents.
- Fewer glow, glass, orb, and gradient effects.
- Smaller radius, flatter surfaces, and stronger grid alignment.
- Data-first sections: agent status, wallet, latest decision, execution proof, risk gates, performance.

## Scope

Primary scope:

- Main dashboard page.
- Shared dashboard styling in `frontend/app/globals.css`.
- Existing navbar only if needed for visual consistency.

Out of scope for this pass:

- Trading logic.
- API/data contracts.
- Smart contracts.
- Copy-heavy redesign of all secondary pages.
- New image/brand asset generation.

## UX Structure

The first viewport should answer five questions quickly:

1. Is the agent live?
2. What is the current portfolio state?
3. What did the agent decide recently?
4. Was execution proven or blocked?
5. What risk controls are active?

The dashboard should still expose proof-of-reasoning, validator blocks, and performance, but those claims should support the live operating state instead of dominating the first screen.

## Visual Rules

- No decorative radial orbs.
- No heavy glass hero treatment.
- Avoid dominant purple/green neon gradients.
- Use cards only for bounded data panels.
- Prefer tables, rows, chips, and compact metric blocks over marketing cards.
- Keep border radius at 8px or below for operational UI.
- Preserve dark theme, but shift toward neutral graphite with restrained cyan/emerald/amber/red semantics.

## Reversibility

The fallback is the current `main` branch at commit `f1d6d53`.

This branch should be evaluated visually before merge. If weaker, do not merge. If partly successful, cherry-pick only the useful components/styles.

## Verification

- Run frontend lint/build.
- Inspect desktop and mobile screenshots.
- Check the first viewport for text overflow and visual clutter.
- Confirm live health/status data still renders truthfully.
