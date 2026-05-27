/**
 * StatusBadge — unified status indicator component.
 * Provides consistent styling for all status badges across the app.
 *
 * Spec: design-enhancement R8
 */

type BadgeVariant =
  | "live"
  | "idle"
  | "offline"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "preview";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  pulse?: boolean;
  tooltip?: string;
  className?: string;
}

const VARIANTS: Record<
  BadgeVariant,
  { bg: string; border: string; text: string; dot: string }
> = {
  live: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    dot: "bg-green-400",
  },
  idle: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  offline: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  preview: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
};

export function StatusBadge({
  variant,
  label,
  pulse = false,
  tooltip,
  className = "",
}: StatusBadgeProps) {
  const v = VARIANTS[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${v.bg} ${v.border} ${v.text} text-[10px] font-mono uppercase tracking-wider ${className}`}
      title={tooltip}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${v.dot} ${
          pulse ? "animate-pulse" : ""
        }`}
      />
      {label}
    </span>
  );
}
