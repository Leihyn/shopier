"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Loader2,
  X,
  Zap,
  CheckCheck,
  ExternalLink,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePurchase } from "@/lib/usePurchase";

interface InboxEntry {
  id: string;
  watchId: string;
  walletPubkey: string;
  lookId: string;
  celebSlug: string;
  totalBudgetUsd: number;
  status: "pending" | "cancelled" | "bought" | "expired";
  autoBuyAt: number | null;
  boughtTxSig: string | null;
  createdAt: number;
}

/**
 * Auto-buy banner — the showpiece UX.
 *
 * Polls /api/watches/inbox every 2s while a wallet is connected. When a
 * pending entry appears with `autoBuyAt` in the future, displays a fixed
 * banner across the bottom of the screen with:
 *
 *   ⚡ Watching · Zendaya · "ice blue silk shift gown" · $240
 *   [Cancel]                       Auto-buying in 28s …
 *
 * After the countdown expires, the UI changes to "Tap to confirm settle" —
 * a single Phantom prompt fires the buy. When session-key delegation is
 * deployed in v1, this final tap disappears entirely.
 *
 * Multiple pending entries stack (most recent on top). A confirmed buy turns
 * the banner green for 6s with the tx sig, then dismisses.
 */
export default function AutoBuyBanner() {
  const wallet = useWallet();
  const walletStr = wallet.publicKey?.toBase58() ?? null;
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Poll inbox while wallet connected
  useEffect(() => {
    if (!walletStr) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/watches/inbox?wallet=${walletStr}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEntries(data.entries ?? []);
      } catch {
        /* swallow */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletStr]);

  // Tick clock every 250ms while there's anything pending
  useEffect(() => {
    const hasPending = entries.some(
      (e) => e.status === "pending" || e.status === "bought"
    );
    if (!hasPending) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [entries]);

  // Most recent pending OR most recent bought (within 6s) — only one banner
  const displayEntry = useMemo(() => {
    const pending = entries.find((e) => e.status === "pending");
    if (pending) return pending;
    const bought = entries
      .filter((e) => e.status === "bought" && now - e.createdAt < 60_000)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return bought ?? null;
  }, [entries, now]);

  if (!displayEntry || !walletStr) return null;

  return (
    <Banner
      entry={displayEntry}
      now={now}
      busyId={busyId}
      setBusyId={setBusyId}
      walletStr={walletStr}
    />
  );
}

function Banner({
  entry,
  now,
  busyId,
  setBusyId,
  walletStr,
}: {
  entry: InboxEntry;
  now: number;
  busyId: string | null;
  setBusyId: (s: string | null) => void;
  walletStr: string;
}) {
  const { purchase } = usePurchase();
  const [error, setError] = useState<string | null>(null);
  // Tracks whether THIS entry has been auto-fired by the timer effect, so we
  // don't double-trigger if the parent re-renders during the buy.
  const [autoFired, setAutoFired] = useState(false);
  const isBought = entry.status === "bought";
  const remaining = entry.autoBuyAt
    ? Math.max(0, Math.floor((entry.autoBuyAt - now) / 1000))
    : null;
  const expired = remaining !== null && remaining === 0;

  async function cancel() {
    setBusyId(entry.id);
    try {
      await fetch(`/api/watches/inbox/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", wallet: walletStr }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmBuy() {
    setBusyId(entry.id);
    setError(null);
    try {
      // Real settlement: spending_policy.check_spend → record_spend (or
      // record_spend_as_delegate if session key is unlocked + within bounds)
      // + USDC SPL transfer to merchant. Returns the real tx signature which
      // we persist on the inbox entry.
      const result = await purchase(entry.totalBudgetUsd, "USDC");
      await fetch(`/api/watches/inbox/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-bought",
          wallet: walletStr,
          txSig: result.signature,
        }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  // Auto-fire: when the 30s window expires AND this is an auto-buy entry
  // (autoBuyAt was set, not notify-only), trigger confirmBuy without user
  // interaction. The session-key path inside usePurchase signs silently
  // when an active delegation covers the amount; otherwise Phantom prompts
  // — still no user click, just a wallet popup. Both are demo-acceptable.
  useEffect(() => {
    if (
      expired &&
      entry.autoBuyAt &&
      entry.status === "pending" &&
      !autoFired &&
      !busyId &&
      !error
    ) {
      setAutoFired(true);
      void confirmBuy();
    }
    // Reset the auto-fired flag if the user dismissed or the entry transitioned
    if (entry.status !== "pending" && autoFired) {
      setAutoFired(false);
    }
    // confirmBuy is stable enough through closure; useEffect deps cover the
    // state we care about. Disable the lint rule for this useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, entry.autoBuyAt, entry.status, autoFired, busyId, error]);

  const baseClasses =
    "fixed inset-x-2 bottom-3 z-50 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:bottom-4 sm:min-w-[480px]";

  if (isBought) {
    return (
      <div
        className={cn(
          baseClasses,
          "celebrate border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCheck size={16} />
          <div className="text-xs">
            <div className="font-semibold">Settled · {entry.celebSlug}</div>
            <div className="font-mono text-[10px] opacity-70">
              ${entry.totalBudgetUsd} · {entry.boughtTxSig?.slice(0, 18)}…
            </div>
          </div>
        </div>
        <a
          href={`https://explorer.solana.com/tx/${entry.boughtTxSig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold hover:bg-emerald-500/10"
        >
          Receipt <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  // error overlay (settles to the same banner row)
  if (error) {
    return (
      <div
        className={cn(
          baseClasses,
          "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <div className="min-w-0 text-xs">
            <div className="font-semibold">Buy failed · {entry.celebSlug}</div>
            <div className="truncate text-[11px] opacity-80">{error}</div>
          </div>
        </div>
        <button
          onClick={() => setError(null)}
          className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] font-semibold hover:bg-rose-500/10"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // pending state with auto-buy ticking → full-width broadcast strip below the
  // LiveTicker. This is the demo's most theatrical moment and deserves the
  // viewport's attention. After expiry → falls back to corner banner. The
  // notify-only state (no autoBuyAt) also uses the corner banner.
  if (entry.autoBuyAt && !expired && remaining !== null && remaining > 0) {
    return (
      <div className="fixed inset-x-0 top-7 z-[58] border-b border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <Zap
            size={18}
            className="shrink-0 text-amber-500 pulse-glow rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Auto-buying for you · {entry.celebSlug} · ${entry.totalBudgetUsd}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">
              Settling in {remaining} seconds — agent acts within your
              spending bound. Tap cancel to abort.
            </p>
          </div>
          <div className="shrink-0 font-mono text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {remaining}s
          </div>
          <button
            onClick={cancel}
            disabled={busyId === entry.id}
            className="shrink-0 rounded-full border border-amber-500/40 bg-background/80 px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-rose-500/10 hover:text-rose-700 disabled:opacity-40"
          >
            {busyId === entry.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              "Cancel"
            )}
          </button>
        </div>
      </div>
    );
  }

  // notify-only OR expired → corner banner (existing layout)
  return (
    <div
      className={cn(
        baseClasses,
        expired
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-border bg-background/95"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {entry.autoBuyAt ? (
          <Zap size={16} className="shrink-0 text-amber-500" />
        ) : (
          <Bell size={14} className="shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 text-xs">
          <div className="truncate font-semibold">
            {entry.autoBuyAt ? "Settling now" : "Look ready"} · {entry.celebSlug}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            ${entry.totalBudgetUsd} look
            {expired && (
              <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-600 dark:text-amber-400">
                ready
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {false && (
          <button
            onClick={cancel}
            disabled={busyId === entry.id}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
          >
            {busyId === entry.id ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <X size={11} />
            )}
            Cancel
          </button>
        )}
        {(expired || remaining === null) && (
          <button
            onClick={confirmBuy}
            disabled={busyId === entry.id}
            className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-40"
          >
            {busyId === entry.id ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Zap size={11} />
            )}
            Settle now
          </button>
        )}
      </div>
    </div>
  );
}
