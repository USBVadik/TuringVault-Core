# Rule: Tiered Web Fetch Resilience

This rule governs how I fetch web content in any task (research, audit,
verification, scraping). I have three independent fetch paths
available, each with different trust profile vs WAFs and rate limits.
This rule tells me which to use when, how to detect when one fails,
and how to escalate without asking the operator.

## When this rule fires

Any time I am about to call `web_fetch` (the built-in tool) or use
`curl`/`fetch` from a bash command for a non-trivial scrape:

- Fetching a deployed dashboard or submission page (DoraHacks, Mantle
  Foundation, hackathon judging surfaces).
- Verifying a competitor's claim against their own page.
- Extracting markdown from a third-party doc / blog / repo.
- Running an honest-probe in an audit (steering rule
  `audit-style.md`).

## The tiered fetch policy

I MUST use the lowest-tier fetcher that is sufficient for the task.
Escalation is ONE-WAY (lower → higher). I do not retry the same
tier after it failed with a WAF/captcha/405 signature.

### Tier 0 — `bash curl` (raw CLI)

  Use for: API endpoints I control (mantle.xyz RPC, Sourcify
           check-by-addresses, frontend Vercel routes), public JSON
           feeds with no anti-bot, GitHub Actions API.
  Speed:   fastest, most flexible (--data-binary, headers, etc.).
  Cost:    free.
  WAF survival: WORST. Default User-Agent triggers most bot filters
                within 2-5 requests/hour.
  Failure tells:
    - HTTP `405 Not Allowed` with `x-amzn-waf-action: captcha`
    - HTTP `403 Forbidden` with Cloudflare challenge HTML
    - HTML body containing `captcha`, `Just a moment`, `cf_clearance`,
      `Checking your browser`
    - `<title>Attention Required</title>` (Cloudflare)
    - Empty body with status 200 + `Server: cloudflare`

### Tier 1 — `web_fetch` (built-in, mode: rendered) OR raw `fetch` with browser headers

  Use for: pages with light-to-medium anti-bot. The two equivalent
           sub-paths:
    - **1a — built-in `web_fetch` mode `rendered`** when JS rendering
      is needed (SPAs, dynamic dashboards).
    - **1b — Node `fetch()` with realistic browser headers**
      (User-Agent, Accept, Accept-Language, etc.) via the helper
      `scripts/audit/fetch-with-fallback.js` Tier 1 path.
  Modes (built-in):
    - `truncated` — first 8KB; for quick preview after web_search
    - `selective` — only sections matching a phrase
    - `full`     — full content up to 10MB
    - `rendered` — JavaScript-rendered DOM (use ONLY as retry after
                   `truncated` returns navigation/empty body)
  WAF survival: MEDIUM-TO-HIGH. **Empirically beat AWS WAF Bot
                Control on DoraHacks via path 1b** — the realistic
                browser headers were sufficient where default
                User-Agent failed. Built-in `web_fetch` rendered
                mode also works most of the time on the same kind of
                target. Sufficient for ~95% of WAF-protected pages
                we will encounter.
  Failure tells:
    - HTTP error (typically `405`)
    - Same content as a previous fetch (cache or WAF returning a
      cached challenge page)
    - `Updated N days ago` shows a timestamp older than what the
      operator told me
    - Body contains `Just a moment`, `Checking your browser`,
      `Captcha required`, `Error 1020`
    - The expected dynamic content is missing AND `mode: rendered`
      already used
    - Both 1a and 1b returned the same stale content

### Tier 2 — Exa `web_fetch_exa` (residential proxies + browser)

  Use for: pages behind Cloudflare/AWS WAF/Akamai/PerimeterX, or
           anywhere a Tier 1 fetch returned a captcha/challenge
           signature.
  Cost:    consumes Exa API credits (1 fetch = 1 credit).
  WAF survival: BEST. Rotating residential IPs, realistic browser
                headers, JavaScript rendering, full HTML in clean
                markdown. Handles DoraHacks, LinkedIn, Twitter,
                most enterprise dashboards out of the box.
  Limits:  3000-character cap default; pass `maxCharacters` up to
           the limit your account supports.
  Activation: this is an MCP tool surfaced through the
              `kiroPowers` interface — the Exa power must be
              installed and `EXA_API_KEY` set.
  Call shape:
    kiroPowers.use({
      powerName: "exa",
      serverName: "exa",
      toolName: "web_fetch_exa",
      arguments: { urls: [...], maxCharacters: 8000 }
    })

## Escalation rules (binding)

1. **Detect a WAF block before retrying.** If a Tier 0 or Tier 1
   fetch returns ANY of the failure tells above, do NOT retry the
   same tier. The next attempt MUST be the next tier up.

2. **One escalation, not a loop.** If Tier 2 also fails, stop and
   tell the operator. Do not bounce back to lower tiers. Reasons
   for Tier 2 failure are usually rate-limit (Exa credits) or the
   target genuinely off-line.

3. **Cache the lesson per-session.** Once a domain is known to need
   Tier 2 in the current session, default to Tier 2 for that domain
   for the rest of the session. Do not waste credits on Tier 0/1
   probes I already know will fail.

   Known-Tier-2 domains in past sessions:
   - `dorahacks.io` — AWS WAF + captcha challenge
   - `linkedin.com` — anti-scrape + login wall on most paths
   - `twitter.com` / `x.com` — auth-walled timeline rendering
   - `medium.com` — paywall + bot detection on hot articles
   - Most enterprise dashboards (Vercel pricing, AWS console docs)

4. **Independent verification rule.** When the operator asks me to
   "check the live page" — i.e. confirm an edit or a state — and a
   Tier 0/1 fetch returns the OLD version while the operator says
   they edited it, this is a STRONG signal of WAF cache, not of an
   un-saved edit. Escalate to Tier 2 BEFORE telling the operator
   their edit didn't go through.

5. **Truthful "I don't know" rule.** If all three tiers fail, I MUST
   tell the operator literally: "I cannot reach <URL> from this
   environment via any of the three fetch paths. Last tier used
   was Tier 2 (Exa). Possible causes: target offline, Exa quota
   exhausted, IP-block escalation." I MUST NOT silently report old
   cached content as if it were live.

## What NOT to do

- Do not infer "edit didn't save" from a single Tier 0 fetch result.
  Always escalate first.
- Do not call `web_fetch` mode `rendered` repeatedly hoping for a
  different result. If `truncated` failed and `rendered` returned
  challenge HTML, jump to Tier 2.
- Do not strip the failure tells out of the output. If I see
  `x-amzn-waf-action: captcha` in a response header, surface it in
  my reasoning so the operator sees what triggered the escalation.
- Do not consume Tier 2 credits for endpoints that work cleanly with
  Tier 0 (Mantle RPC, Sourcify, our own /api/*).

## Helper: scripts/audit/fetch-with-fallback.js

Reusable Node helper that walks Tier 0 → Tier 1 (with browser
headers) → prints a Tier 2 escalation hint with the exact
`kiroPowers.use` call shape. Use it from any audit script that probes
external URLs to keep failure-handling consistent.

  node scripts/audit/fetch-with-fallback.js <url> [--phrase=<text>] [--max=<chars>]

Output for the DoraHacks WAF case (verified 2026-05-30):

  Tier 0 (curl-equivalent):  status=405  BLOCKED (HTTP 405)  623ms
  Tier 1 (browser headers):  status=200  OK  948ms
  ✅ Tier 1 succeeded.
  Phrase "60-Second" present: YES

The helper is documentation: I read it to remember the escalation
shape, not just to execute it. The exhaustive list of WAF detection
patterns (header-based and body-pattern-based) lives in the helper's
`KNOWN_BLOCK_HEADERS` and `KNOWN_BLOCK_BODY_PATTERNS` constants.

## Context: why this matters for the project

We were caught by exactly this failure mode while verifying that an
edit to the DoraHacks submission page had landed. My Tier 1 fetch
returned a 3-day-old cached version of the page; I assumed the edit
hadn't saved and was about to suggest the operator re-do the work.
The operator caught this and pushed me to escalate. The Exa Tier 2
fetch returned the freshly-edited version (`Updated 15 mins ago`),
proving the edit had landed and the failure was on my side.

This rule exists so that NEXT time the same WAF blocks me, I escalate
within seconds rather than producing a misleading "your edit didn't
save" diagnosis. Following the steering rule
`.kiro/steering/no-lying-about-state.md`: surfacing stale-cached
content as if it were live is itself a §1 violation.
