"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Zap, Check } from "lucide-react";
import type { WatchMode } from "@/lib/watchesDb";
import {
  ixSetWatchPolicy,
  WatchPolicyMode,
  WatchSectionFilter,
  WatchRegisterFilter,
} from "@/lib/solana";

function modeToOnchain(m: WatchMode): WatchPolicyMode {
  return m === "notify"
    ? WatchPolicyMode.NotifyOnly
    : m === "auto-buy-under-cap"
    ? WatchPolicyMode.AutoBuyUnderCap
    : WatchPolicyMode.AutoBuyFull;
}

interface Props {
  eventSlug: string;
  eventTitle: string;
  celebs: { slug: string; celeb: string }[];
}

/**
 * "Watch all celebs at this event" — bulk subscribe.
 *
 * One signature config, then POSTs N watches (one per celeb) all event-scoped
 * to this event. Used for tentpole events like Met Gala where the user wants
 * coverage across the entire night, not per-celeb.
 */
export default function EventWatchAllButton({
  eventSlug,
  eventTitle,
  celebs,
}: Props) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletStr = wallet.publicKey?.toBase58() ?? null;
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [maxUsd, setMaxUsd] = useState(800);
  const [mode, setMode] = useState<WatchMode>("auto-buy-under-cap");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  async function subscribeAll() {
    if (!walletStr || !wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Read existing watches so we merge instead of overwriting
      const existing = await fetch(`/api/watches?wallet=${walletStr}`).then(
        (r) => r.json()
      );
      const existingSlugs: string[] = (existing.watches ?? []).map(
        (w: { celebSlug: string }) => w.celebSlug
      );
      const merged = Array.from(
        new Set([...existingSlugs, ...celebs.map((c) => c.slug)])
      );

      // 2. ONE on-chain set_watch_policy with all N celebs — single Phantom
      //    prompt instead of N. The trust container is now event-scoped.
      const ix = ixSetWatchPolicy(
        wallet.publicKey,
        merged,
        WatchSectionFilter.Any,
        WatchRegisterFilter.Any,
        modeToOnchain(mode),
        BigInt(maxUsd),
        eventSlug
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
      setTxSig(sig);

      // 3. Then bulk SQLite per-celeb. N is ≤ 10 so sequential is fine.
      for (const c of celebs) {
        await fetch("/api/watches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletPubkey: walletStr,
            celebSlug: c.slug,
            celebName: c.celeb,
            mode,
            maxPerLookUsd: maxUsd,
            eventScope: eventSlug,
          }),
        }).catch(() => {});
      }
      setDone(true);
      setOpen(false);
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
        className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground"
      >
        Connect wallet to watch event
      </button>
    );
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <Check size={12} /> Watching {celebs.length} celebs at {eventTitle}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
      >
        <Zap size={12} className="text-amber-300" />
        Watch all {celebs.length} celebs
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-[61] w-[min(90vw,400px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border/70 bg-background p-5 shadow-2xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Watch {eventTitle}
          </div>

          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            One Phantom signature creates an on-chain WatchPolicy covering all{" "}
            {celebs.length} celebs in this event. The matcher fires the moment
            any of them appears in the look feed.
          </p>
          {error && (
            <p className="mb-3 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          {txSig && !error && (
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 block rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-emerald-600 hover:underline dark:text-emerald-400"
            >
              On-chain tx: {txSig.slice(0, 18)}…
            </a>
          )}

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Mode
          </label>
          <div className="mb-3 flex gap-1">
            {(
              [
                { v: "notify", label: "Notify" },
                { v: "auto-buy-under-cap", label: "Auto ≤ cap" },
                { v: "auto-buy-full", label: "Full auto" },
              ] as { v: WatchMode; label: string }[]
            ).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={
                  "flex-1 rounded-lg border px-2 py-1.5 text-[11px] " +
                  (mode === v
                    ? "border-foreground/40 bg-muted/40 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/20")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Cap per look (USD)
          </label>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={maxUsd}
              onChange={(e) => setMaxUsd(Number(e.target.value))}
              className="flex-1 bg-transparent text-sm tabular-nums outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={subscribeAll}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              Subscribe all
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
            >
              Cancel
            </button>
          </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
