# Audit 28 — walletRouter Wrap-Everything Bug + Risk-Off Streak Diagnosis

**Date**: 2026-05-30
**Trigger**: Operator flagged that the agent has been spending native
MNT (the asset that pays for gas) on every risk-off cycle for ~24h.
Investigation produced two related findings: (1) a sustained-streak
bug in walletRouter that wraps essentially all available native MNT
into WMNT every time WMNT falls below floor, and (2) a market-driven
explanation for why the streak fired in the first place.

---

## Symptom

`/api/health.gasRunway` showed `nativeMnt = 1.56 MNT`,
`status = critical`, `daysRemaining ≈ 0.4` at audit open.

Pre-fix wallet history (replay manifests cycles 149-159):

  cycles 143-148: action=hold, direction=neutral
  cycles 149-159: action=swap, direction=risk_off  (11 consecutive)
  cycles after 159: continuing risk_off

Each risk-off cycle either consumed WMNT or, when WMNT fell below
floor (0.1), wrapped a large chunk of native MNT into WMNT and then
swapped that into USDT0. Native MNT balance trajectory:

  pre-streak (cycle ~145): ~30 MNT
  audit open (cycle ~165): ~1.56 MNT
  net consumed in ~24h:    ~28 MNT

---

## Root cause #1 — wrap-everything-wrappable

`src/dex/walletRouter.js` previously sized the wrap as:

  const wrapAmount = wrappableMnt;       // wrap everything wrappable

where `wrappableMnt = max(0, balances.MNT - GAS_RESERVE_MNT)` and
`GAS_RESERVE_MNT = 1.0`. The intent was: "leave 1 MNT for gas, wrap
the rest so the swap has meaningful size".

The bug: 1.0 MNT reserve was sized for a 24-cycle horizon between
wraps, **but the wrap was unbounded on the upper end**. On a 30-MNT
wallet, a single risk-off cycle would wrap 29 MNT in one shot. The
NEXT risk-off cycle would then see WMNT > floor and skip the wrap —
fine. But once that WMNT pile was consumed (a few cycles later) and
WMNT dropped below floor again, walletRouter would wrap whatever
residual MNT remained, again unbounded.

Across an 11-cycle streak this collapsed cumulative native MNT from
~30 to ~1.56 — exactly the trajectory we observed.

The 1.0 MNT reserve was also too low: it provided ~13 cycles
worst-case at 0.077 MNT/cycle, less than 7 hours of runway with no
operator intervention.

---

## Root cause #2 — market-driven risk-off streak

The wrap-everything bug only fires when the agent picks risk-off
**often**. The proximate trigger of the 24h streak is in the
analyst's reasoning (replay manifest cycle 0159):

> ETH grid signal = EXIT_RANGING with channel breaking down and
> volatility expanding (bearish breakdown). MNT grid at 93% of
> channel with SELL_mETH signal (80% confidence) and favorable
> 2.5:1 R:R at resistance $0.64. Funding at 0.523% is mildly
> long-biased but not extreme. Extreme Fear (F&G=23) with bearish
> signal consensus supports defensive positioning.

This is the analyst doing its job: ETH is leaking, MNT is at
resistance, Fear & Greed at 23 (Extreme Fear). The structurally
correct call is "rotate to stables". So the system is correctly
detecting the regime AND correctly choosing the asset side, but
the wrap-sizing layer turned that correct call into a self-funding
death spiral on native MNT.

Net read: the agent's strategy wasn't broken; the wrap layer made
correct strategy lethal at scale.

---

## What ships

### `src/dex/walletRouter.js` (changes)

1. `GAS_RESERVE_MNT`: 1.0 → **5.0**.

   Rationale: at 0.077 MNT/cycle worst-case × 48 cycles/day,
   5.0 MNT is enough for ~1.4 days of cycles BELOW the floor.
   That is the operator-react buffer — the time between the UI
   `GAS · CRITICAL` pill turning red and the agent actually
   bricking. 1.4 days is short, but conservative (the worst-case
   per-cycle figure assumes every cycle does 8 TXs incl. 3 swaps;
   typical sustained cycles are closer to 0.04 MNT).

2. New constant `MAX_WRAP_PER_CYCLE_MNT = 2.0`.

   Hard cap on how much native MNT can convert to WMNT per cycle.
   2.0 MNT ≈ $1.30 of WMNT, more than enough for the typical
   $0.50-1.00 swap size and small enough that ten consecutive
   risk-off cycles consume at most 20 MNT instead of effectively
   the whole wallet.

3. Wrap sizing: `min(wrappableMnt, max(floor*4, 0.4),
   MAX_WRAP_PER_CYCLE_MNT)`.

   Replaces "wrap everything". The `max(floor*4, 0.4)` term
   ensures we wrap enough to avoid dust at typical floors.

4. Sanity gate: `pickSource` refuses a wrap that would leave
   `balances.MNT - wrapAmount < gasReserveMnt`.

   This is the second layer of defence. Even if `wrappableMnt`
   subtraction is computed correctly, this hard gate refuses to
   ever cross the reserve floor regardless of cap value or balance
   shape.

### `frontend/app/api/health/route.ts` (changes)

The `gasRunway.daysRemaining` projection now subtracts the reserve
floor:

  spendableMnt = max(0, nativeMnt - GAS_RESERVE_MNT_FLOOR)
  cyclesRemaining = floor(spendableMnt / 0.077)
  daysRemaining = cyclesRemaining / 48

This matches reality: walletRouter refuses to wrap below the floor,
so MNT below the floor is not actually spendable on cycles. The
reserve is operator-react buffer, not runway.

Status thresholds unchanged: ok > 14d, low 7-14d, critical < 7d.

New field `gasReserveMntFloor` exposed in the response so the UI
tooltip and any judge probing the endpoint can see the assumption.

### `tests/unit/walletRouter.unit.test.js` (changes)

- `WMNT below floor + native MNT available → wrap MNT first`:
  expects wrap size capped at `MAX_WRAP_PER_CYCLE_MNT` rather than
  `MNT − GAS_RESERVE_MNT`.
- `native MNT below gas reserve → refuses to wrap`: new test.
- `sanity gate: refuses wrap that would land remaining MNT below
  gas reserve`: new test.
- `sustained-streak protection: 10 consecutive wraps cap total at
  10×MAX`: new test that simulates the cycles-149-159 case study
  and asserts the cap holds across the streak.
- `custom floors override defaults — but cap still applies`:
  updated to verify the cap.

14/14 tests passing (was 11; +3 new on cap behaviour).

---

## Validation

  jest:           276 / 276 passing  (273 → 276; +3 from walletRouter cap)
  ESLint src/:    0 errors / 48 warnings
  frontend lint:  0 errors / 15 warnings
  tsc --noEmit:   clean
  next build:     clean, 25 routes

### Live state at audit close

  Agent EOA native MNT:  1.5596
  Reserve floor:         5.0000
  Spendable above floor: 0.0000
  Cycles remaining:      0
  Days runway:           0.00
  Status:                critical

The agent is below the new reserve floor. walletRouter will refuse
wraps until the operator tops up native MNT. Cycles will continue to
log INTENT_SWAP_NO_EXEC with a clear reason; the integrity invariant
test (audit 27) ensures none of those rows lie about
EXECUTED_SWAP. UI pill on the homepage shows `GAS · CRITICAL · 0d`.

Required operator action: top-up agent EOA
`0xDC783CDBfA993f3FC299460627b204E83bf4fb5a` to ≥ 70 MNT (covers
17-day submission window with 10x buffer above the 5 MNT reserve).

---

## What this does NOT fix

This audit fixes the wrap layer. It does NOT change the analyst's
behaviour — if the market remains in EXIT_RANGING + Extreme Fear,
the system will continue to produce risk-off recommendations. That
is correct strategy.

What changes after the operator tops up:

- Each risk-off cycle wraps at most 2 MNT instead of effectively all.
- After ~10 consecutive risk-off cycles, native MNT consumption is
  bounded at 20 MNT instead of the wallet total.
- USDT0 accumulates at the same rate as before (one swap per cycle
  is unchanged); native MNT runway shrinks linearly and slowly.
- When the market eventually rotates to risk-on, the accumulated
  USDT0 funds the rotation back through the existing path, and
  native MNT is preserved through the entire cycle of cycles.

If the operator wants the agent to ALSO modulate swap size against
remaining gas runway (e.g. shrink risk-off swap dollar amount when
runway < 14 days so it lasts longer), that is a separate spec. Out
of scope for this audit.
