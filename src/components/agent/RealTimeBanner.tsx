"use client";

import { useState } from "react";
import { useSessionDelegate } from "@/lib/useSessionDelegate";
import { fromStableUnits } from "@/lib/solana";
import { Loader2, Zap, X } from "lucide-react";

/**
 * Banner shown on /agent prompting the user to enable real-time shopping
 * (session-key delegation). Once enabled, shows expiry + revoke button.
 */
export default function RealTimeBanner() {
  const { state, busy, enable, revoke, error } = useSessionDelegate();
  const [maxPerTx, setMaxPerTx] = useState(50);
  const [maxDaily, setMaxDaily] = useState(200);
  const [showSetup, setShowSetup] = useState(false);

  if (state.loading) return null;

  // Active state — show indicator + revoke
  if (state.active && state.onChain) {
    const expiresAt = Number(state.onChain.expiresAt) * 1000;
    const hoursLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 3600000));
    const minutesLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 60000) % 60);
    const spent = fromStableUnits(state.onChain.spentToday);
    const limit = fromStableUnits(state.onChain.maxDaily);

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-green-500/5 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-green-500" />
          <span className="font-medium">Real-time mode</span>
          <span className="text-muted-foreground">
            · ${spent.toFixed(2)} / ${limit.toFixed(0)} today · expires in {hoursLeft}h {minutesLeft}m
          </span>
        </div>
        <button
          onClick={() => revoke()}
          disabled={busy}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {busy ? <Loader2 size={11} className="inline animate-spin" /> : "Revoke"}
        </button>
      </div>
    );
  }

  // Setup state — expanded form
  if (showSetup) {
    return (
      <div className="border-b border-border/50 bg-muted/20 px-4 py-3 text-xs">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Enable real-time shopping</p>
            <p className="mt-1 text-muted-foreground">
              Generates a session key encrypted with your wallet. Your agent signs
              purchases under these bounds without Phantom popups. 24-hour
              expiry. Bounded on-chain — the master spending policy is the ceiling.
            </p>
          </div>
          <button
            onClick={() => setShowSetup(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Max per tx — ${maxPerTx}
            </label>
            <input
              type="range"
              min={10}
              max={200}
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Max daily — ${maxDaily}
            </label>
            <input
              type="range"
              min={maxPerTx}
              max={500}
              value={maxDaily}
              onChange={(e) => setMaxDaily(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        {error && (
          <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-400">
            {error}
          </p>
        )}
        <button
          onClick={async () => {
            try {
              await enable({ maxPerTxUsd: maxPerTx, maxDailyUsd: maxDaily });
              setShowSetup(false);
            } catch {
              // error stored in hook state
            }
          }}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={11} className="animate-spin" />}
          {busy ? "Setting up…" : "Enable (sign 2 wallet prompts)"}
        </button>
      </div>
    );
  }

  // Idle state — small CTA, low-noise
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-1.5 text-[11px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Zap size={11} className="text-amber-500" />
        Real-time mode · <span className="text-muted-foreground/70">off</span>
      </span>
      <button
        onClick={() => setShowSetup(true)}
        className="font-medium text-foreground hover:text-muted-foreground"
      >
        Enable →
      </button>
    </div>
  );
}
