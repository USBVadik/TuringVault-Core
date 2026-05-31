This script needs both:
  /tmp/gh-secrets.txt  — one secret name per line (from `gh secret list`)
  /tmp/vercel-env.txt  — one env var name per line (from `vercel env ls`)

Build them with these commands (operator side):
  gh secret list --json name -q '.[].name' > /tmp/gh-secrets.txt
  vercel env ls > /tmp/vercel-env.txt   # then sed to extract names only

This audit run will produce a manual-input section instead.

## Env drift — MANUAL INPUT REQUIRED

Operator: provide both lists, then re-run.
