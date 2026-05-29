# Rule: Due diligence BEFORE recommending any external on-chain integration

This is a hard process rule, not a soft preference. The project's
defining narrative is "AI agent that proves every allocation survived
adversarial challenge BEFORE execution." Recommending integration with
a protocol that recently suffered an exploit, oracle malfunction,
governance crisis, bridge incident, or ongoing recovery — without
doing the research first — is a self-inflicted narrative collapse.

## When this rule fires

Any time I am about to suggest:

- A new lending / borrowing market integration (Aave, Compound,
  Lendle, Init, Spark, Morpho, etc.).
- A new yield source / vault / strategy contract.
- A new DEX or aggregator beyond what we already use.
- A new bridge or cross-chain route.
- A new oracle dependency.
- A new tokenized RWA issuer (treasuries, real estate, credit).
- Any partner whose smart contract we will call from our cron.

It does not matter if the protocol is well-known, blue-chip, or
"obviously fine". Due diligence is mandatory before the recommendation
text leaves the response.

## What I must check, in this order

1. **Last 90 days exploit / incident search.**
   Query the web for `<protocol> exploit|hack|incident|bug 2026`,
   plus the same for any underlying primitive the protocol depends
   on (e.g. for Aave V3 also search KelpDAO, rsETH, Chainlink,
   bridges they consume). 90 days because attackers reuse vectors;
   a one-month-old incident is still hot.

2. **Bad debt status.** Is there outstanding bad debt? Has it been
   socialised, written off, or recovered? Are LTV ratios still
   restricted from a previous incident? Cite source + date.

3. **Oracle / price-feed track record.** Any misconfiguration
   liquidations in the last 90 days? Aave's CAPO oracle wiped
   $26M in March 2026 from a 2.85% wstETH undervaluation — this
   class of failure is invisible in code reviews.

4. **Bridge / multi-sig / DVN exposure.** If the protocol's
   collateral can be inflated through a bridge flaw (KelpDAO 1-of-1
   DVN flaw → $292M unbacked rsETH cascading into Aave), our
   AUM is exposed even if their contracts perform exactly as
   written. Map the dependency chain.

5. **Governance / legal status.** Any active lawsuits, sanctions
   complications, recovery plans subject to vote? Funds frozen?
   This affects whether we can get capital out under stress.

6. **Native vs imported risk.** Is the integration on the same
   chain as the protocol's home, or is it a cross-chain port? Most
   of the worst incidents come from imported risk on L2s (rsETH on
   Mantle/Arbitrum was the heaviest exposure in April 2026).

7. **Time-to-recovery.** If there has been an incident, is recovery
   complete or partial? "Borrowing limits restored" is not the same
   as "bad debt resolved". For a hackathon submission we have
   ~17 days to deadline; we can not absorb a redo.

## Output format when due diligence is done

When recommending an integration that passed the checks, the
recommendation must include a **Risk panel** with these fields,
filled in with cited sources:

```
Risk panel — <protocol> on <chain>
  Incident history (90d):    <yes/no> + brief
  Active bad debt:           <yes/no> + amount + source
  Oracle integrity (90d):    <ok/issue> + source
  Cross-chain exposure:      <none/specific dependency>
  Active governance crisis:  <yes/no>
  Recovery status:           <none-needed/partial/complete>
  Net verdict:               <SAFE/CAUTIOUS/AVOID>
  Last checked:              <ISO date> + URL of primary source
```

If the verdict is anything other than SAFE, the recommendation
text must lead with the risks, not with the upside.

## Default posture when uncertain

When the research surfaces meaningful risk, default to **AVOID**.
The hackathon's defining narrative is capital preservation through
adversarial validation. Chasing yield through a recovering protocol
to lift one rubric axis is a bad trade against the narrative
collapse risk. **"Light uncertainty" is the competitive position
of every other entry in the AI x RWA Track — joining them is not
weakness, it's the right read of the moment.**

Native yield paths (mETH staking, USDT0 peg stability, etc.) that
do not require a counterparty contract are preferred over external
integrations, even if they yield less, because they survive
counterparty incidents.

## What to do when I have already made an unsafe recommendation

1. Self-correct in the same conversation as soon as I notice or am
   told. Do not minimise.
2. Append a Risk panel with the actual incident data.
3. Propose a risk-graded alternative (native yield, deferred
   integration, smaller cap with disclosure).
4. Do not implement anything in that direction until the operator
   has explicitly confirmed they want it given the risks.

## What this rule does NOT prevent

- Reading code, running tests, building UI features, refactoring,
  doc edits, prompt tuning, fixing bugs.
- Discussing protocols hypothetically with the operator.
- Adding a protocol to an audit, threat model, or research note.

The rule fires only when I am about to recommend that we wire our
cron's signing key into someone else's contract.
