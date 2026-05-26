#!/usr/bin/env node
/**
 * Export pitch-deck/index.html to a PDF via headless Chromium.
 *
 * Why not just use the browser's Cmd+P? Because Chrome's interactive
 * print dialog has multiple ways to silently strip backgrounds, fail
 * @page sizing, or rasterize gradients into ugly opaque circles.
 * This headless path enforces:
 *   - exact colour reproduction (`printBackground: true`)
 *   - native 1280x720 page size matching @page CSS
 *   - no margins, no headers/footers
 *
 * Usage:
 *   node docs/pitch-deck/export-pdf.js
 *
 * Output:
 *   docs/pitch-deck/turingvault-pitch.pdf
 */

const { chromium } = require('playwright');
const path = require('path');

const HTML = path.resolve(__dirname, 'index.html');
const OUT = path.resolve(__dirname, 'turingvault-pitch.pdf');

(async () => {
  console.log('▶ Launching headless Chromium…');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`  Loading file://${HTML}`);
  await page.goto('file://' + HTML, { waitUntil: 'networkidle' });

  // Tailwind CDN sometimes finishes restyling after networkidle.
  // Explicit wait so the dark background + monospace fonts settle.
  await page.waitForTimeout(800);

  console.log('  Generating PDF…');
  await page.pdf({
    path: OUT,
    width: '1280px',
    height: '720px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    pageRanges: '',           // all
    displayHeaderFooter: false,
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`✓ Wrote ${path.relative(process.cwd(), OUT)}`);
})().catch((e) => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});
