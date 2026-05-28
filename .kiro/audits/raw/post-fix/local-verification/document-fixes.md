# Local File Verification — Document Fixes

**Verified at:** 2026-05-28T09:42Z

## P0-1: Rejection Rate Harmonization (61.5%)

- `README.md:50` — "61.5% rejection rate" ✅
- `README.md:365` — "Adversarial validation (61.5% rejection rate)" ✅
- `agent-card-v2.json:104` — `"blockRate": "61.5%"` ✅
- `docs/pitch-deck/index.html:577` — "61.5%" stat number ✅
- `docs/pitch-deck/index.html:721` — "61.5%" stat number ✅

## P0-2: RWA NAV Allocation (55%)

- `README.md:52` — "55%+ of agent NAV in tokenized Treasuries" ✅

## P0-3: Decision Count (104+)

- `docs/pitch-deck/index.html:392` — "104+ decisions logged" ✅
- `docs/pitch-deck/index.html:717` — "104+" stat number ✅
- `docs/pitch-deck/index.html:832` — "104 on-chain TXs" ✅

## P0-4: Sourcify Claim (4/5)

- `docs/pitch-deck/index.html:697` — "4/5 Sourcify-verified (Router pending)" ✅
- `docs/pitch-deck/index.html:803` — "4/5 contracts Sourcify-verified (Router pending)" ✅

## P0-5: Confidence Gate (60%)

- `README.md:159` — "Score < 60%" ✅

## P0-6: R:R Ratio (1.5:1)

- No "2:1" found in README.md ✅ (was the old incorrect value)

## design-P0-1: Entry Animations

- `frontend/app/backtest/page.tsx:87` — `anim-fade-up` class ✅
- `frontend/app/discipline/page.tsx:162` — `anim-fade-up` class ✅
- `frontend/app/social/page.tsx:130` — `anim-fade-up` class ✅
- `frontend/app/challenge/page.tsx:163` — `anim-fade-up` class ✅

## design-P0-3: Mobile Responsive

- `frontend/app/globals.css:933` — `@media (max-width: 768px)` block 1 ✅
- `frontend/app/globals.css:970` — `@media (max-width: 768px)` block 2 ✅
- `frontend/app/globals.css:1006` — `@media (prefers-reduced-motion: reduce)` ✅
- Deployed CSS chunk contains 768px media queries (2 matches) ✅
