/**
 * SectionHeader — consistent section header component.
 * Replaces emoji-based headers with Lucide icons.
 *
 * Spec: design-enhancement R1
 */

import { type LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  iconColor?: string;
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  iconColor = "text-purple-400",
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">
        {title}
      </h2>
      {subtitle && (
        <span className="text-[10px] font-mono text-white/30">{subtitle}</span>
      )}
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}
