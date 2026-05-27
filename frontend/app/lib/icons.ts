/**
 * Icon mapping for consistent icon usage across the app.
 * Replaces emoji with Lucide icons for professional appearance.
 *
 * Spec: design-enhancement R1
 */

import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Link,
  Zap,
  Shield,
  Skull,
  BarChart3,
  Rocket,
  Eye,
  Bot,
  Swords,
  GitBranch,
  Activity,
  Brain,
  Wallet,
  ExternalLink,
  Terminal,
  Cpu,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

// Semantic icon mapping
export const ICONS = {
  // Status
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,

  // Actions
  performance: TrendingUp,
  analytics: BarChart3,
  activity: Activity,

  // Concepts
  chain: Link,
  live: Zap,
  security: Shield,
  danger: Skull,
  pump: Rocket,
  oracle: Eye,
  bot: Bot,
  challenge: Swords,
  evolution: GitBranch,
  brain: Brain,
  wallet: Wallet,
  external: ExternalLink,
  terminal: Terminal,
  compute: Cpu,
  social: MessageCircle,
} as const;

export type IconName = keyof typeof ICONS;

// Helper to get icon by name
export function getIcon(name: IconName): LucideIcon {
  return ICONS[name];
}

// Re-export commonly used icons for convenience
export {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Link,
  Zap,
  Shield,
  Skull,
  BarChart3,
  Rocket,
  Eye,
  Bot,
  Swords,
  GitBranch,
  Activity,
  Brain,
  Wallet,
  ExternalLink,
  Terminal,
  Cpu,
  MessageCircle,
};
