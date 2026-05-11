"use client";

import { usePathname } from "next/navigation";
import { useBridgeMode } from "@/lib/useBridgeMode";
import { Globe2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Pages where ActivityRail already shows live broadcast UI — hide the
// floating pill there to avoid visual competition. The mode is still
// readable from the LookCard NGN badges and the rail's mini-toggle.
const HIDE_PILL_ON = [/^\/$/, /^\/trending$/, /^\/events\/.+/];

/**
 * Floating Bridge-A mode pill — bottom-left corner.
 *
 * Lets users / judges toggle the active fulfillment-bridge adapter:
 *   · Lagos · Raenest  (NGN remittance)
 *   · Global · Crossmint  (USDC checkout)
 *
 * Surfaces the bridge-framework moat without requiring a config detour.
 */
export default function BridgeModePill() {
  const { mode, toggle } = useBridgeMode();
  const pathname = usePathname();
  const isLagos = mode === "lagos";

  // Suppress on broadcast pages so the activity rail owns the bottom-left
  if (HIDE_PILL_ON.some((re) => re.test(pathname))) {
    return null;
  }

  // /agent has a sticky input row at the bottom (Photo + textarea + Send) —
  // pill must sit ABOVE it. Other pages can use the cleaner bottom anchor.
  const isAgent = /^\/agent(\/.*)?$/.test(pathname);
  const positionClasses = isAgent
    ? "fixed bottom-24 right-4 z-40 sm:bottom-28"
    : "fixed bottom-3 right-3 z-40 sm:bottom-4 sm:right-4";

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur transition-colors",
        positionClasses,
        isLagos
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          : "border-border bg-background/85 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
      title={
        isLagos
          ? "Bridge A: Raenest (USDC → NGN). Click to switch to Global."
          : "Bridge A: Crossmint (Global). Click to switch to Lagos / Raenest."
      }
    >
      {isLagos ? <MapPin size={11} /> : <Globe2 size={11} />}
      <span>
        {isLagos ? "Lagos · Raenest" : "Global · Crossmint"}
      </span>
      <span className="ml-1 rounded-md bg-foreground/10 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider">
        Bridge A
      </span>
    </button>
  );
}
