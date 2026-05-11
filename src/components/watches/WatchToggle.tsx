"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Bell,
  BellOff,
  Check,
  Loader2,
  Zap,
  Link2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WatchMode } from "@/lib/watchesDb";
import {
  ixSetWatchPolicy,
  WatchPolicyMode,
  WatchSectionFilter,
  WatchRegisterFilter,
} from "@/lib/solana";
import { useSetupStatus } from "@/lib/useSetupStatus";

function modeToOnchain(m: WatchMode): WatchPolicyMode {
  switch (m) {
    case "notify":
      return WatchPolicyMode.NotifyOnly;
    case "auto-buy-under-cap":
      return WatchPolicyMode.AutoBuyUnderCap;
    case "auto-buy-full":
      return WatchPolicyMode.AutoBuyFull;
  }
}
function sectionToOnchain(s: string | null | undefined): WatchSectionFilter {
  switch (s) {
    case "mens":
      return WatchSectionFilter.Mens;
    case "womens":
      return WatchSectionFilter.Womens;
    case "both":
      return WatchSectionFilter.Both;
    case "androgynous":
      return WatchSectionFilter.Androgynous;
    default:
      return WatchSectionFilter.Any;
  }
}
function registerToOnchain(r: string | null | undefined): WatchRegisterFilter {
  switch (r) {
    case "masculine":
      return WatchRegisterFilter.Masculine;
    case "neutral":
      return WatchRegisterFilter.Neutral;
    case "feminine":
      return WatchRegisterFilter.Feminine;
    default:
      return WatchRegisterFilter.Any;
  }
}

interface WatchToggleProps {
  celebSlug: string;
  celebName: string;
  /** Optional — if set, the watch only fires for this event slug */
  eventScope?: string | null;
  /** Default cap shown in the popover; user can adjust before confirming */
  defaultMaxUsd?: number;
  /** Default mode in the popover */
  defaultMode?: WatchMode;
  /** Optional className for outer button */
  className?: string;
  /** Compact variant — icon + label only, no descriptions */
  compact?: boolean;
}

interface ServerWatch {
  id: string;
  celebSlug: string;
  mode: WatchMode;
  maxPerLookUsd: number;
  eventScope: string | null;
}

/**
 * Watch-this-celeb toggle.
 *
 * Renders:
 *   · Off state — "Watch · Zendaya" CTA
 *   · On state  — "Watching · 🔔 notify | ⚡ auto-buy under $X"
 *
 * Click off→on opens a popover where the user picks the mode + cap, then
 * POSTs to /api/watches. The watch then drives the inbox poller — when
 * a match comes in, the AutoBuyBanner takes over.
 */
export default function WatchToggle({
  celebSlug,
  celebName,
  eventScope = null,
  defaultMaxUsd = 800,
  defaultMode = "auto-buy-under-cap",
  className,
  compact = false,
}: WatchToggleProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletStr = wallet.publicKey?.toBase58() ?? null;
  const setup = useSetupStatus();

  const [active, setActive] = useState<ServerWatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<WatchMode>(defaultMode);
  const [pendingMax, setPendingMax] = useState<number>(defaultMaxUsd);
  const [lastTxSig, setLastTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trigger ref kept for focus management; position is now centered modal,
  // not anchored — eliminates stacking-context bugs entirely.
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-buy modes silently fail if the spending policy or session-key
  // delegation isn't set up. We surface the missing prereq before letting the
  // user submit. Notify-only mode has no prereqs beyond a wallet.
  const isAutoBuyMode = pendingMode !== "notify";
  const missingPrereq: string | null = isAutoBuyMode
    ? !setup.policyReady
      ? "policy"
      : !setup.realTimeReady
      ? "realtime"
      : null
    : null;

  // Hydrate active state from server
  useEffect(() => {
    if (!walletStr) {
      setActive(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/watches?wallet=${walletStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const match = (data.watches as ServerWatch[] | undefined)?.find(
          (w) =>
            w.celebSlug === celebSlug &&
            (eventScope ? w.eventScope === eventScope : true)
        );
        setActive(match ?? null);
      })
      .catch(() => {
        /* swallow */
      });
    return () => {
      cancelled = true;
    };
  }, [walletStr, celebSlug, eventScope]);

  async function turnOn() {
    if (!walletStr || !wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Read current SQLite watches so we can build the full celeb list
      //    that will live on-chain. The on-chain WatchPolicy holds ALL
      //    actively-watched celebs in one PDA — adding one means re-writing
      //    the whole list with the new entry appended.
      const existing = await fetch(`/api/watches?wallet=${walletStr}`).then(
        (r) => r.json()
      );
      const existingSlugs: string[] = (existing.watches ?? []).map(
        (w: { celebSlug: string }) => w.celebSlug
      );
      const merged = Array.from(new Set([...existingSlugs, celebSlug]));

      // 2. Build + sign the on-chain set_watch_policy tx. This is the trust
      //    container — what the matcher will check before firing auto-buys.
      //    Filters apply to ALL watched celebs as a group; SQLite holds
      //    per-celeb mode/cap when users want differentiated config.
      const ix = ixSetWatchPolicy(
        wallet.publicKey,
        merged,
        sectionToOnchain(null),
        registerToOnchain(null),
        modeToOnchain(pendingMode),
        BigInt(pendingMax),
        eventScope
      );
      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      setLastTxSig(sig);

      // 3. Once the chain is settled, persist the per-celeb metadata in
      //    SQLite so the matcher can fire and the inbox can render.
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPubkey: walletStr,
          celebSlug,
          celebName,
          mode: pendingMode,
          maxPerLookUsd: pendingMax,
          eventScope,
        }),
      });
      const data = await res.json();
      if (data.watch) {
        setActive(data.watch);
        setOpen(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function turnOff() {
    if (!active || !walletStr || !wallet.publicKey || !wallet.signTransaction)
      return;
    setLoading(true);
    setError(null);
    try {
      // 1. Read remaining SQLite watches (after this revoke)
      const existing = await fetch(`/api/watches?wallet=${walletStr}`).then(
        (r) => r.json()
      );
      const remaining: string[] = (existing.watches ?? [])
        .filter((w: { celebSlug: string }) => w.celebSlug !== celebSlug)
        .map((w: { celebSlug: string }) => w.celebSlug);

      // 2. If celebs remain, re-write WatchPolicy with the reduced list.
      //    If empty, ideally we'd call clear_watch_policy to refund rent;
      //    for now we just write an empty list to keep the PDA cheap to
      //    update (full close requires a separate signature flow).
      const ix = ixSetWatchPolicy(
        wallet.publicKey,
        remaining,
        sectionToOnchain(null),
        registerToOnchain(null),
        modeToOnchain(active.mode),
        BigInt(active.maxPerLookUsd),
        eventScope
      );
      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      setLastTxSig(sig);

      // 3. Now revoke the SQLite row
      await fetch(`/api/watches/${active.id}?wallet=${walletStr}`, {
        method: "DELETE",
      });
      setActive(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!walletStr) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground",
          className
        )}
        title="Connect wallet to watch"
      >
        <BellOff size={12} /> Connect to watch
      </button>
    );
  }

  // ON state — show short summary, click to revoke
  if (active) {
    return (
      <div className={cn("inline-flex flex-col gap-0.5", className)}>
        <button
          onClick={turnOff}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          {compact
            ? "Watching"
            : `Watching · ${
                active.mode === "notify"
                  ? "notify"
                  : `auto-buy ≤ $${active.maxPerLookUsd}`
              }`}
        </button>
        {lastTxSig && !compact && (
          <a
            href={`https://explorer.solana.com/tx/${lastTxSig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1 text-[9px] uppercase tracking-wider text-emerald-600/80 hover:text-emerald-600"
          >
            <Link2 size={9} /> on-chain · {lastTxSig.slice(0, 8)}
          </a>
        )}
      </div>
    );
  }

  // OFF state — click opens config popover (portaled to body so it escapes
  // any parent stacking context / overflow clipping)
  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground"
        )}
      >
        <Bell size={12} />
        {compact ? "Watch" : `Watch · ${celebName}`}
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Dimmed backdrop catches outside clicks to dismiss */}
            <div
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Centered modal — guaranteed visible, never off-screen.
                max-h-[85vh] + overflow-y-auto so internal content scrolls
                if the popover ever exceeds viewport. */}
            <div
              className="fixed left-1/2 top-1/2 z-[61] w-[min(90vw,360px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border/70 bg-background p-5 shadow-2xl"
            >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Watch {celebName}
            {eventScope && (
              <span className="ml-1 rounded bg-muted/60 px-1 py-0.5 font-mono text-[9px]">
                {eventScope}
              </span>
            )}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Mode
          </label>
          <div className="mb-3 flex flex-col gap-1">
            <ModeRow
              mode="notify"
              active={pendingMode === "notify"}
              onClick={() => setPendingMode("notify")}
              icon={<Bell size={12} />}
              label="Notify only"
              hint="ping me, I'll decide"
            />
            <ModeRow
              mode="auto-buy-under-cap"
              active={pendingMode === "auto-buy-under-cap"}
              onClick={() => setPendingMode("auto-buy-under-cap")}
              icon={<Zap size={12} className="text-amber-500" />}
              label="Auto-buy under cap"
              hint="agent settles if total ≤ cap, else notify"
            />
            <ModeRow
              mode="auto-buy-full"
              active={pendingMode === "auto-buy-full"}
              onClick={() => setPendingMode("auto-buy-full")}
              icon={<Zap size={12} className="text-amber-500" />}
              label="Auto-buy any look"
              hint="full autonomy within cap (max risk)"
            />
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Cap per look (USD)
          </label>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={pendingMax}
              onChange={(e) => setPendingMax(Number(e.target.value))}
              className="flex-1 bg-transparent text-sm tabular-nums outline-none"
            />
          </div>

          {/* SNS hint — celebs with .sol show their identity here */}
          <div className="mb-4 flex items-center gap-1 text-[9px] text-muted-foreground">
            <span>Watching</span>
            <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono">
              {celebSlug}
              {/^[a-z]+$/.test(celebSlug) && (
                <span className="ml-0.5 text-emerald-600 dark:text-emerald-400">
                  .sol
                </span>
              )}
            </span>
            <span>—</span>
            <span>resolves via Bonfida; identity portable if owner rotates wallet.</span>
          </div>

          {/* Prereq gate — auto-buy modes need policy + delegation. Surface it
              clearly before the user signs and the watch then fails silently. */}
          {missingPrereq && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-[11px] leading-snug">
              <AlertTriangle
                size={11}
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {missingPrereq === "policy"
                    ? "Spending policy required for auto-buy"
                    : "Real-time mode required for auto-buy"}
                </p>
                <p className="text-muted-foreground">
                  {missingPrereq === "policy"
                    ? "The agent settles via record_spend_as_delegate inside your spending policy. Initialize one first."
                    : "Enable real-time mode (set_delegate) so the agent can sign your buy without re-prompting Phantom."}
                </p>
                <Link
                  href={
                    missingPrereq === "policy" ? "/agent/wallet" : "/agent"
                  }
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  Fix it <ArrowRight size={10} />
                </Link>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Or pick <strong>Notify only</strong> above — no prereqs, just
                  a ping when matched.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={turnOn}
              disabled={loading || !!missingPrereq}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {missingPrereq ? "Set up first" : "Start watching"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Phantom signs <code className="font-mono">set_watch_policy</code>{" "}
            on-chain — your watchlist becomes a tamper-proof PDA. The agent
            then settles within your spending-policy cap; auto-buy modes fire
            without re-prompting Phantom.
          </p>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function ModeRow({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  mode: WatchMode;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        active
          ? "bg-foreground/10 ring-1 ring-foreground/30"
          : "hover:bg-muted/40"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
