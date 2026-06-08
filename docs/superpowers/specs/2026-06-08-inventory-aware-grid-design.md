# Inventory-Aware Grid Design

Date: 2026-06-08

## Goal

Reduce the agent's stable-heavy passivity without turning the bot into an unconditional dip buyer.

## Decision

Avellaneda-Stoikov style inventory control is implemented as deterministic strategy logic, not as raw RAG text. The PDF/research idea is distilled into a reservation-bid calculation and an external-evidence score. LLMs still analyze and validate the candidate, but they do not own the final risk boundary.

## Flow

1. Structured market data produces regime, grid, funding, Nansen flow, fear/greed, and technical context.
2. `inventoryAwareGrid` computes an inventory-skewed reservation bid:
   - stable-heavy inventory raises the bid and allows small risk-on probes;
   - risk-heavy inventory lowers the bid and makes sells easier.
3. A contrarian buy candidate can appear in `TREND_DOWN` only when all are true:
   - wallet is stable-heavy and position state is `FLAT`;
   - asset is near the lower grid band;
   - there is no confirmed down-break;
   - smart-money flow is not strongly bearish;
   - capitulation evidence is strong enough from funding, RSI, fear/greed, and inventory skew.
4. Candidate size is capped at 3-6% allocation before portfolio guard and validator review.
5. Claude receives the candidate with reservation bid, edge score, route, risk/reward, and risk factors.

## Safety Rules

- `CRISIS` blocks contrarian buys.
- Strong Nansen/smart-money outflow blocks contrarian buys.
- Confirmed down-break blocks contrarian buys.
- The portfolio guard remains the final deterministic veto before execution.
- Heartbeat swaps remain tagged separately and must not count as ordinary alpha execution.

## UI Honesty

ValidationRegistry counters are validator proposal verdicts, not executed trades. Discipline counters are post-execution check verdicts, not trade approvals. User-facing labels must keep those scopes separate.
