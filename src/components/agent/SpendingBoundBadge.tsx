"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  fetchPolicy,
  fetchDaily,
  type PolicyConfig,
  type DailyState,
} from "@/lib/solana";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live spending-policy display.
 *
 * Two render modes:
 *   - `compact`: single-row pill — Today $X / $Y · max $Z · resets in Nh
 *     Used in the /agent header where vertical space is precious.
 *   - default (full card): progress bar + 2-fact grid — used on dedicated
 *     surfaces (e.g., /agent/wallet) where the bound deserves space.
 *
 * Reads the user's policy + daily counter PDAs and polls every 12s.
 * Falls back to an "Initialize policy" CTA when no policy exists.
 */
export default function SpendingBoundBadge({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setPolicy(null);
      setDaily(null);
      return;
    }
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        fetchPolicy(connection, publicKey),
        fetchDaily(connection, publicKey),
      ]);
      setPolicy(p);
      setDaily(d);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12_000); // poll every 12s — non-disruptive
    return () => clearInterval(id);
  }, [refresh]);

  if (!publicKey) {
    return null;
  }

  if (loading && !policy) {
    if (compact) {
      // Skeleton shimmer matches the eventual single-row pill shape
      return (
        <div className="flex items-center gap-3 px-3 py-1.5">
          <div className="skeleton h-3 w-12 rounded-md" />
          <div className="skeleton h-1 flex-1 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-md" />
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
        <div className="skeleton h-3 w-32 rounded-md" />
        <div className="skeleton mt-3 h-1.5 w-full rounded-full" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="skeleton h-10 rounded-md" />
          <div className="skeleton h-10 rounded-md" />
        </div>
      </div>
    );
  }

  if (!policy) {
    return (
      <a
        href="/agent/wallet"
        className={cn(
          "flex items-center gap-2 text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400",
          compact
            ? "bg-amber-500/10 px-3 py-1.5 text-[11px]"
            : "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs"
        )}
      >
        <AlertCircle size={compact ? 11 : 14} />
        <span>
          <span className="font-semibold">No spending policy</span> — initialize one before the agent can buy.
          {compact && <span className="ml-1">→</span>}
        </span>
      </a>
    );
  }

  const maxPerTxUsd = Number(policy.maxPerTx) / 1_000_000;
  const maxDailyUsd = Number(policy.maxDaily) / 1_000_000;
  const autoApproveUsd = Number(policy.autoApproveUnder) / 1_000_000;
  const spentUsd = daily ? Number(daily.spent) / 1_000_000 : 0;
  const remainingUsd = Math.max(0, maxDailyUsd - spentUsd);
  const pct = maxDailyUsd > 0 ? Math.min(100, (spentUsd / maxDailyUsd) * 100) : 0;
  const tone = pct > 80 ? "rose" : pct > 50 ? "amber" : "emerald";
  const accentBar =
    tone === "rose"
      ? "bg-rose-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-emerald-500";
  const accentBg =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/5"
      : tone === "amber"
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-emerald-500/30 bg-emerald-500/5";

  // Time until daily reset
  const lastReset = Number(daily?.lastResetUnix ?? 0);
  const nextReset = lastReset + 86_400;
  const secsUntilReset = Math.max(0, nextReset - Math.floor(Date.now() / 1000));
  const hoursUntilReset = Math.floor(secsUntilReset / 3600);
  const minutesUntilReset = Math.floor((secsUntilReset % 3600) / 60);

  // Compact pill — single row, ~32px tall. Used on /agent header to save
  // vertical space for the chat. Full breakdown is one click away on
  // /agent/wallet so we don't lose any information.
  if (compact) {
    const accentText =
      tone === "rose"
        ? "text-rose-700 dark:text-rose-400"
        : tone === "amber"
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 text-[11px]",
          accentBg
        )}
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={11} className={accentText} />
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Policy
          </span>
        </span>
        {/* Compact progress bar */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className={cn("h-full transition-all duration-500", accentBar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono tabular-nums">
            <span className="font-semibold">${spentUsd.toFixed(0)}</span>
            <span className="text-muted-foreground"> / ${maxDailyUsd.toFixed(0)}</span>
          </span>
        </div>
        <span className="hidden font-mono text-[10px] tabular-nums text-muted-foreground sm:inline">
          max ${maxPerTxUsd.toFixed(0)}/tx
        </span>
        <span className="hidden font-mono text-[10px] tabular-nums text-muted-foreground md:inline">
          resets in {hoursUntilReset}h
        </span>
        <a
          href="/agent/wallet"
          className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Manage →
        </a>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-4", accentBg)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Spending policy · live
          </span>
        </div>
        <a
          href="/agent/wallet"
          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Manage →
        </a>
      </div>

      {/* Daily progress */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Today
          </span>
          <span className="font-mono text-xs tabular-nums">
            <span className="font-semibold text-foreground">
              ${spentUsd.toFixed(2)}
            </span>
            <span className="text-muted-foreground">
              {" "}
              / ${maxDailyUsd.toFixed(0)}
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn("h-full transition-all duration-500", accentBar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
          ${remainingUsd.toFixed(2)} remaining · resets in {hoursUntilReset}h{" "}
          {minutesUntilReset}m
        </p>
      </div>

      {/* Per-tx + auto-approve facts */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-md border border-border/60 bg-background p-2">
          <p className="uppercase tracking-wider text-muted-foreground">
            Max per tx
          </p>
          <p className="mt-0.5 font-mono text-xs tabular-nums">
            ${maxPerTxUsd.toFixed(0)}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background p-2">
          <p className="uppercase tracking-wider text-muted-foreground">
            Auto-approve under
          </p>
          <p className="mt-0.5 font-mono text-xs tabular-nums">
            ${autoApproveUsd.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
