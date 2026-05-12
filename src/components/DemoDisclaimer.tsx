"use client";

import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Floating demo-build disclaimer chip.
 *
 * Surfaces that the celebrity imagery on Shopier is illustrative for the
 * demo — production deployment would license editorial content from a CDN
 * provider rather than hot-link source URLs.
 *
 * Sits at bottom-center on every page. On /agent it shifts higher to clear
 * the sticky message-input row, matching BridgeModePill's pattern.
 */
export default function DemoDisclaimer() {
  const pathname = usePathname();
  const isAgent = /^\/agent(\/.*)?$/.test(pathname);

  const positionClasses = isAgent
    ? "bottom-24 sm:bottom-28"
    : "bottom-3 sm:bottom-4";

  return (
    <div
      className={cn(
        "fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/85 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-lg backdrop-blur",
        positionClasses
      )}
      title="Demo build. Celebrity imagery is illustrative — production would license editorial content from a CDN provider. No rights claimed in this demo."
    >
      <Info size={11} />
      <span>Demo build · illustrative imagery</span>
    </div>
  );
}
