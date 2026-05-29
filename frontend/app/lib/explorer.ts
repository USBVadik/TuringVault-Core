/**
 * Mantle block-explorer URL helper with built-in fallback.
 *
 * External Gemini Pro 3.1 audit Section 3 weakness #3:
 *   "If a judge clicks a proof link and gets a Cloudflare error, your
 *    radical transparency claim instantly dies."
 *
 * Mantlescan and the official explorer.mantle.xyz both periodically
 * return 502 / 522 from Cloudflare. The two are independent — when
 * one is down the other is usually up. This helper:
 *
 *   1. Returns a primary URL (mantlescan.xyz — better UI, faster).
 *   2. Returns a fallback URL (explorer.mantle.xyz — official, used
 *      by Mantle docs).
 *   3. Components that want a single href use primary; components
 *      that want to surface both can render a small "(alt)" link.
 *
 * Workspace honesty rule §1: every visible link must point to a
 * verifiable artifact. Two mirrors > one.
 */

export type ExplorerKind = "tx" | "address" | "block";

interface ExplorerLinks {
  primary: string;
  fallback: string;
  /** Short label for the alt link, e.g. "(alt)". */
  fallbackLabel: string;
}

const PRIMARY = "https://mantlescan.xyz";
const FALLBACK = "https://explorer.mantle.xyz";

export function explorerLink(kind: ExplorerKind, value: string): ExplorerLinks {
  // Sanitise — never trust caller-supplied values to be already
  // URL-safe. Both explorers expect 0x-prefixed hex addresses /
  // tx hashes; block can be a number or hash. encodeURIComponent
  // the value defensively so a bad input can't break the URL.
  const safe = encodeURIComponent(String(value));
  const path = kind === "tx" ? `tx/${safe}` : kind === "block" ? `block/${safe}` : `address/${safe}`;
  return {
    primary: `${PRIMARY}/${path}`,
    fallback: `${FALLBACK}/${path}`,
    fallbackLabel: "alt",
  };
}

/**
 * Convenience: just the primary URL when the caller doesn't care
 * about surfacing the alt link in the UI.
 */
export function explorerUrl(kind: ExplorerKind, value: string): string {
  return explorerLink(kind, value).primary;
}
