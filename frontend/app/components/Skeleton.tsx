/**
 * Skeleton — loading placeholder components.
 * Provides consistent loading states across the app.
 *
 * Spec: design-enhancement R4
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-white/5 rounded ${className}`} />;
}

// Card skeleton
export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`glass-card p-6 space-y-4 ${className}`}>
      <Skeleton className="w-1/3 h-3" />
      <Skeleton className="w-full h-8" />
      <Skeleton className="w-2/3 h-3" />
    </div>
  );
}

// Table row skeleton
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <div
      className="table-v2-row"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

// Stat card skeleton
export function SkeletonStat() {
  return (
    <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
      <Skeleton className="w-8 h-2 mx-auto mb-2" />
      <Skeleton className="w-16 h-6 mx-auto mb-2" />
      <Skeleton className="w-12 h-2 mx-auto" />
    </div>
  );
}

// Stats grid skeleton
export function SkeletonStatsGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}
