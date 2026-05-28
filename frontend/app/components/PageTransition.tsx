"use client";

/**
 * FE-09: Page transition wrapper using CSS animations.
 * Provides a fade-up entrance animation for page content on route changes.
 * Uses pathname as key to trigger re-mount and CSS animation replay.
 */

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="anim-fade-up">
      {children}
    </div>
  );
}
