# Subsystem Status Notes

## Grid Strategy (`src/data/grid_*.json`)

**Status:** Paused since 2026-05-23.

The grid trading subsystem (adaptive ranging grid bot) is inactive by design.
The multi-agent consensus loop replaced grid execution as the primary strategy.
Grid state files remain for reference and potential future reactivation:

- `grid_bot_state.json` — last known positions/funding
- `grid_config.json` — upper/lower channel bounds
- `grid_param_history.json` — parameter evolution log
- `grid_trades.json` — historical grid fills

These files are not read by the production cron cycle or any API route.

## Raw Model Outputs (`src/data/raw_model_outputs/`)

**Status:** Testing-phase diagnostic artifacts from 2026-05-26 (20 files).

**Purpose:** During development, raw LLM responses were captured verbatim
before JSON parsing to debug format compliance issues. Files are named
`{timestamp}_{role}_{hash}.txt`.

**Retention policy:** These are not written by the production cron cycle.
They exist solely as development artifacts for auditing parse success rates.
Safe to prune after submission if repo size becomes a concern. Not exposed
via any API endpoint.


## Environment Variable Split (CI-05)

**Intentional design:** Vercel (frontend) has 2 env vars vs GitHub Actions (cron)
with 13 env vars. This is by design:

- **Vercel (frontend):** Only needs `NEXT_PUBLIC_*` vars for contract addresses
  and `WALLET_CONNECT_PROJECT_ID`. All data is read from state files committed
  to the repo or fetched from on-chain via public RPC. No secrets needed.

- **GitHub Actions (cron runner):** Needs API keys for Bedrock, Vertex AI,
  Pinata, Nansen, Elfa, CoinGecko + PRIVATE_KEY for TX signing. All secrets
  stored as GitHub Actions secrets, never exposed to Vercel.

This separation minimizes attack surface: a Vercel compromise gives zero
access to signing keys or API credentials.
