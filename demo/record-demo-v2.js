#!/usr/bin/env node
/**
 * Demo recording driver — automates the browser for Screen Studio.
 *
 * Screen Studio records WHATEVER is happening on screen, so this script
 * just orchestrates a smooth click-through of the dashboard:
 *   1. Home page top-to-bottom slow scroll (NAV, RWA strip, Discipline,
 *      Live Terminal)
 *   2. /challenge — clicks all 4 attack vectors in order
 *   3. /discipline — opens latest cycle, expands a history row
 *   4. Back home, brief pause on the contracts table
 *
 * Total runtime ~90 seconds. Tuned for a single uncut take.
 *
 * Usage:
 *   1. Open Screen Studio, set up the recording region around your
 *      browser window (1920x1080 or 1440x900 ideal).
 *   2. Click "Start Recording" in Screen Studio.
 *   3. In a separate terminal: `npm run demo:video`
 *   4. The script opens Chromium, runs the choreography, then closes.
 *   5. Click "Stop Recording" in Screen Studio. Trim the head/tail
 *      where the browser opens/closes.
 *
 * Environment overrides:
 *   DEMO_URL          — base URL (default: production Vercel)
 *   DEMO_HEADLESS     — '1' to run headless (no visible window). For
 *                       Screen Studio you want this OFF.
 *   DEMO_SLOWMO       — extra ms between Playwright actions for
 *                       readability (default 250)
 *   DEMO_VIEWPORT_W   — viewport width (default 1440)
 *   DEMO_VIEWPORT_H   — viewport height (default 900)
 *
 * Cinematography notes:
 *   - All scrolls use `window.scrollTo({ top, behavior: 'smooth' })`
 *     which Screen Studio captures beautifully.
 *   - Hovers happen before clicks so the cursor moves visibly.
 *   - Pauses are timed so the viewer has 1-2s to read each section.
 */

const { chromium } = require('playwright');

const URL = process.env.DEMO_URL || 'https://frontend-seven-beta-46.vercel.app';
const HEADLESS = process.env.DEMO_HEADLESS === '1';
const SLOWMO = Number(process.env.DEMO_SLOWMO || 250);
const VIEWPORT_W = Number(process.env.DEMO_VIEWPORT_W || 1440);
const VIEWPORT_H = Number(process.env.DEMO_VIEWPORT_H || 900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Smooth scroll to an absolute Y position over `durationMs`.
 * Native CSS smooth-scroll feels too fast for video; this is paced.
 */
async function smoothScrollTo(page, targetY, durationMs = 2500) {
  await page.evaluate(
    ({ targetY, durationMs }) => {
      return new Promise((resolve) => {
        const startY = window.scrollY;
        const distance = targetY - startY;
        const startTime = performance.now();
        function ease(t) {
          // easeInOutCubic — Screen Studio's natural feel
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        function step(now) {
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / durationMs);
          window.scrollTo(0, startY + distance * ease(t));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
    },
    { targetY, durationMs },
  );
}

async function smoothScrollToSelector(page, selector, durationMs = 2500, offset = 100) {
  const targetY = await page.evaluate(
    ({ selector, offset }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return window.scrollY + rect.top - offset;
    },
    { selector, offset },
  );
  if (targetY == null) {
    console.log(`  (skip scroll — selector not found: ${selector})`);
    return;
  }
  await smoothScrollTo(page, targetY, durationMs);
}

/**
 * Move cursor visibly to an element, then click. Hover-first feels
 * intentional on video.
 */
async function hoverThenClick(page, selector, hoverMs = 600) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  if (!box) {
    console.log(`  (selector not visible: ${selector})`);
    return;
  }
  // Move cursor in a couple steps so it's smooth on screen
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 20, { steps: 8 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await sleep(hoverMs);
  await el.click();
}

async function main() {
  console.log('▶ Demo driver starting');
  console.log(`  URL: ${URL}`);
  console.log(`  Headless: ${HEADLESS}`);
  console.log(`  Viewport: ${VIEWPORT_W}x${VIEWPORT_H}`);
  console.log('');
  console.log('  → If you are recording with Screen Studio, position');
  console.log('    your recording region NOW. Browser opens in 4 seconds.');
  console.log('');
  await sleep(4000);

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOWMO,
    args: ['--window-size=' + VIEWPORT_W + ',' + (VIEWPORT_H + 80)],
  });
  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    deviceScaleFactor: 2,        // crisper screenshots on retina
  });
  const page = await ctx.newPage();

  // ─── ACT 1 — Landing page top ─────────────────────────────────
  console.log('Act 1: home top — hero + NAV');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(2000);

  // Pause on hero (NAV badge, mascot, intro)
  await sleep(2000);

  // ─── ACT 2 — Slow scroll through the dashboard ────────────────
  console.log('Act 2: smooth scroll through sections');

  // Vault Funding block (~roughly 600px down)
  await smoothScrollTo(page, 600, 2000);
  await sleep(1500);

  // Strategy section with regime/grid/RWA/Discipline rows
  await smoothScrollTo(page, 1200, 2200);
  await sleep(2200); // viewer reads RWA + Discipline strip

  // Live Terminal / decisions feed
  await smoothScrollTo(page, 2000, 2200);
  await sleep(1800);

  // Contracts table at bottom
  await smoothScrollTo(page, 2800, 2000);
  await sleep(1500);

  // Footer / verifiable links
  await smoothScrollTo(page, 3600, 1500);
  await sleep(1200);

  // Smooth back to top before next act
  await smoothScrollTo(page, 0, 1500);
  await sleep(800);

  // ─── ACT 3 — Adversarial Challenge ────────────────────────────
  console.log('Act 3: /challenge — fire 4 attack vectors');
  await page.goto(URL + '/challenge', { waitUntil: 'networkidle' });
  await sleep(2000);

  const ATTACKS = [
    { btn: 'button:has-text("Flash Crash")', name: 'flash_crash' },
    { btn: 'button:has-text("Pump")', name: 'pump_signal' },
    { btn: 'button:has-text("Oracle")', name: 'oracle_conflict' },
    { btn: 'button:has-text("Sybil")', name: 'sybil_consensus' },
  ];

  for (const a of ATTACKS) {
    console.log(`  → ${a.name}`);
    await hoverThenClick(page, a.btn, 600);
    // Wait for result block to render (PREVIEW returns ~instantly)
    try {
      await page.waitForSelector('text=ATTACK BLOCKED', { timeout: 5000 });
    } catch {
      // If LIVE mode is on it can take 10s — fall back to a generic wait
      await sleep(5000);
    }
    // Let the viewer see the verdict + reasoning
    await sleep(2400);
    // Smooth scroll down to show full reasoning + on-chain block
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(1800);
    // Back up so next click is visible
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);
  }

  // ─── ACT 4 — Discipline Layer ─────────────────────────────────
  console.log('Act 4: /discipline — gates + history');
  await page.goto(URL + '/discipline', { waitUntil: 'networkidle' });
  await sleep(2200);

  // Show summary tiles
  await smoothScrollTo(page, 200, 1500);
  await sleep(2000);

  // Latest cycle card
  await smoothScrollTo(page, 500, 1800);
  await sleep(2200);

  // History table — try to expand the first row
  try {
    await smoothScrollTo(page, 900, 1800);
    await sleep(1200);
    const firstRow = page.locator('tbody tr').first();
    const rb = await firstRow.boundingBox();
    if (rb) {
      await page.mouse.move(rb.x + 100, rb.y + rb.height / 2, { steps: 10 });
      await sleep(500);
      await firstRow.click();
      await sleep(2500);
    }
  } catch {
    // No data yet — that's fine, we still showed the page exists
    console.log('  (no history rows to expand — empty state shown)');
  }

  // ─── ACT 5 — Back to home, end on contracts ───────────────────
  console.log('Act 5: home, end on contracts table');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);
  await smoothScrollTo(page, 2800, 2500);
  await sleep(2500);

  // Final hold on a contract row so the closing frame is the
  // verifiable proof — not a marketing slide.
  await sleep(2000);

  console.log('\n✓ Demo run complete. Stop Screen Studio recording.');
  console.log('  Trim the head/tail in Screen Studio editor (4s pre-load + 2s post).');

  await browser.close();
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});
