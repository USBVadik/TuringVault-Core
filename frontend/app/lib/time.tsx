/**
 * Time helpers for honest freshness labels.
 *
 * Used across the dashboard to render "X seconds ago" / "Y minutes ago"
 * timestamps in a consistent way. Re-exported via <RelativeTime /> for
 * components that need auto-refreshing labels.
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Format an ISO timestamp as a relative-time string.
 * Returns '—' when the input is missing/invalid.
 *
 * Buckets:
 *   < 60s         → "Xs ago"
 *   < 60m         → "Xm ago"
 *   < 48h         → "Xh ago"
 *   otherwise     → "Xd ago"
 *
 * For timestamps in the future (clock skew), returns "just now"
 * up to 5s in the future, otherwise renders absolute fallback.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';

  const ageMs = Date.now() - ts;
  if (ageMs < -5000) {
    // far-future timestamps — show absolute date as a tell
    return new Date(ts).toISOString().slice(0, 16) + 'Z';
  }
  if (ageMs < 1000) return 'just now';

  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * React component rendering a freshness label that auto-refreshes
 * every 30 seconds while the component is mounted.
 *
 * Usage:
 *   <RelativeTime ts="2026-05-26T08:00:00Z" />
 *   → "7m ago"
 */
export function RelativeTime({
  ts,
  refreshMs = 30_000,
}: {
  ts: string | null | undefined;
  refreshMs?: number;
}) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!ts) return;
    const id = setInterval(() => force(n => n + 1), refreshMs);
    return () => clearInterval(id);
  }, [ts, refreshMs]);

  return <>{formatRelativeTime(ts)}</>;
}
