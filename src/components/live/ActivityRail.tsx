"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Zap,
  Bell,
  Sparkles,
  Radio,
  Globe2,
  MapPin,
} from "lucide-react";
import { useBridgeMode } from "@/lib/useBridgeMode";
import { useSetupStatus } from "@/lib/useSetupStatus";
import { useWalletDisplay } from "@/lib/useWalletDisplay";
import SetupStatusWidget from "./SetupStatusWidget";

interface ActivityEntry {
  id: string;
  kind: "auto-buy" | "indexed" | "watch" | "twin" | "system";
  title: string;
  /** Title with `{wallet}` placeholder; client swaps in resolved .sol or short pubkey. */
  titleTemplate?: string;
  detail: string;
  txSig?: string;
  txSigShort?: string;
  wallet?: string;
  walletFull?: string;
  at: number;
  secondsAgo: number;
  synthetic: boolean;
}

interface ActivityResponse {
  entries: ActivityEntry[];
  realCount: number;
  syntheticCount: number;
}

/**
 * Live activity rail — sticky right sidebar on home, /trending, and /events.
 *
 * Polls /api/activity/live every 5 seconds. Shows a mix of real on-chain
 * activity and synthetic system events; "synthetic" entries are subtly
 * dimmed so the user can tell what's truly on-chain vs system narration.
 *
 * Click a real entry with a txSig to open Solana Explorer.
 */
export default function ActivityRail({
  className,
}: {
  className?: string;
}) {
  const setup = useSetupStatus();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [tick, setTick] = useState(0);

  // Hooks must be called in the same order every render. Place ALL hooks
  // above any conditional return so the order is invariant. The early
  // return for the setup widget happens AFTER hooks, even though the
  // effects then "waste" cycles when the rail isn't visible — that's the
  // Rules of Hooks tradeoff.
  useEffect(() => {
    if (!setup.allReady) return;
    let cancelled = false;
    const fetchData = () =>
      fetch("/api/activity/live")
        .then((r) => r.json())
        .then((d) => !cancelled && setData(d))
        .catch(() => {
          /* swallow */
        });
    fetchData();
    const id = setInterval(fetchData, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setup.allReady]);

  // 1s clock so "ago" labels stay current between fetches
  useEffect(() => {
    if (!setup.allReady) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [setup.allReady]);

  // When the user hasn't completed all 5 prereqs, show the setup checklist
  // instead of the live activity rail.
  if (!setup.allReady) {
    return <SetupStatusWidget className={className} />;
  }

  if (!data) {
    return (
      <aside className={className}>
        <div className="rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Radio size={11} className="text-emerald-500" />
            Live
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="skeleton h-1.5 w-1.5 rounded-full" />
                <div className="skeleton h-3 flex-1 rounded-md" />
                <div className="skeleton h-2 w-6 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // First 5 visible everywhere, the next 3 only on lg+ via Tailwind hide
  const all = data.entries.slice(0, 8);

  return (
    <aside className={className}>
      <div className="rounded-2xl border border-border/60 bg-background p-4">
        {/* Header — Bridge mode collapsed into a small right-side chip */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Radio size={11} className="text-emerald-500" />
            Live
          </div>
          <BridgeModeMini />
        </div>

        <div className="space-y-2.5">
          {all.map((e, i) => (
            <div key={e.id} className={i >= 5 ? "hidden lg:block" : undefined}>
              <Item entry={e} now={Date.now() + tick * 0} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function BridgeModeMini() {
  const { mode, toggle } = useBridgeMode();
  const isLagos = mode === "lagos";
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        isLagos
          ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-muted/40"
      }`}
      title="Switch fulfillment-bridge region"
    >
      {isLagos ? <MapPin size={9} /> : <Globe2 size={9} />}
      <span>{isLagos ? "Lagos" : "Global"}</span>
    </button>
  );
}

function Item({ entry, now }: { entry: ActivityEntry; now: number }) {
  const ago = formatAgo(entry.secondsAgo + Math.floor((Date.now() - now) / 1000));
  const isReal = !entry.synthetic;
  // Resolve .sol for the wallet that triggered this activity, if any
  const walletDisplay = useWalletDisplay(entry.walletFull ?? null);
  const renderedTitle =
    entry.titleTemplate && entry.walletFull
      ? entry.titleTemplate.replace("{wallet}", walletDisplay.display)
      : entry.title;

  const accent = (() => {
    if (entry.kind === "auto-buy")
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    if (entry.kind === "indexed")
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    if (entry.kind === "watch")
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-500";
    if (entry.kind === "system")
      return "bg-muted/40 text-muted-foreground";
    return "bg-muted/40 text-muted-foreground";
  })();

  const Icon = (() => {
    if (entry.kind === "auto-buy") return Zap;
    if (entry.kind === "indexed") return Sparkles;
    if (entry.kind === "watch") return Bell;
    if (entry.kind === "system") return Radio;
    return Activity;
  })();

  // Single-line layout: tiny dot + title + ago. Detail is the title's truncation.
  const inner = (
    <div className={`flex items-baseline gap-2 ${entry.synthetic ? "opacity-50" : ""}`}>
      <span
        className={`mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
          entry.kind === "auto-buy"
            ? "bg-amber-500"
            : entry.kind === "indexed"
            ? "bg-emerald-500"
            : entry.kind === "watch"
            ? "bg-emerald-500"
            : "bg-muted-foreground/50"
        }`}
      />
      <p className="min-w-0 flex-1 truncate text-xs">
        <span className="font-medium">{renderedTitle}</span>
        {walletDisplay.isSns && (
          <span className="ml-1 rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[8px] text-emerald-700 dark:text-emerald-400">
            .sol
          </span>
        )}
      </p>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {ago}
      </span>
    </div>
  );

  if (isReal && entry.txSig) {
    return (
      <a
        href={`https://explorer.solana.com/tx/${entry.txSig}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md transition-colors hover:bg-muted/30"
      >
        {inner}
      </a>
    );
  }

  return <div className="block rounded-md">{inner}</div>;
}

function formatAgo(seconds: number): string {
  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
