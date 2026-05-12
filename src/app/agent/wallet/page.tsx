"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ShieldCheck,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  Wallet,
  ArrowLeft,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import {
  ixInitializePolicy,
  ixUpdatePolicy,
  fetchPolicy,
  fetchDaily,
  toStableUnits,
  policyPda,
  type PolicyConfig,
  type DailyState,
} from "@/lib/solana";
import { cn } from "@/lib/utils";

/**
 * Spending-policy management page.
 *
 * Reads policy + daily counter PDAs from chain. If no policy exists, shows
 * an initialize form. If one exists, shows live values + an update form.
 * Both submit a single Phantom signature; after confirm, state re-reads.
 *
 * This is the prereq surface for auto-buy — without a spending_policy PDA,
 * watches with auto-buy modes can't fire.
 */
export default function AgentWalletPage() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [maxPerTx, setMaxPerTx] = useState<number>(500);
  const [maxDaily, setMaxDaily] = useState<number>(1000);
  const [autoApprove, setAutoApprove] = useState<number>(100);
  const [secondhandFirst, setSecondhandFirst] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setPolicy(null);
      setDaily(null);
      return;
    }
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        fetchPolicy(connection, wallet.publicKey),
        fetchDaily(connection, wallet.publicKey),
      ]);
      setPolicy(p);
      setDaily(d);
      if (p) {
        setMaxPerTx(Number(p.maxPerTx) / 1_000_000);
        setMaxDaily(Number(p.maxDaily) / 1_000_000);
        setAutoApprove(Number(p.autoApproveUnder) / 1_000_000);
        setSecondhandFirst(p.secondhandFirst);
      }
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit() {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const ix = policy
        ? ixUpdatePolicy(
            wallet.publicKey,
            toStableUnits(maxPerTx),
            toStableUnits(maxDaily),
            toStableUnits(autoApprove),
            secondhandFirst
          )
        : ixInitializePolicy(
            wallet.publicKey,
            toStableUnits(maxPerTx),
            toStableUnits(maxDaily),
            toStableUnits(autoApprove),
            secondhandFirst
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
      setStatus(
        `${policy ? "Updated" : "Initialized"} · tx ${sig.slice(0, 16)}…`
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!wallet.publicKey) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 pt-24 pb-24">
          <Link
            href="/agent"
            className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={11} /> /agent
          </Link>
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
            <Wallet size={28} className="mx-auto mb-3 text-muted-foreground" />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Connect your wallet
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The spending policy lives in a PDA seeded by your wallet. Connect
              Phantom to read or write yours.
            </p>
          </div>
        </main>
      </>
    );
  }

  const [policyAddr] = policyPda(wallet.publicKey);
  const spentUsd = daily ? Number(daily.spent) / 1_000_000 : 0;
  const policyMaxDailyUsd = policy ? Number(policy.maxDaily) / 1_000_000 : 0;
  const pct =
    policyMaxDailyUsd > 0
      ? Math.min(100, (spentUsd / policyMaxDailyUsd) * 100)
      : 0;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24">
        <Link
          href="/agent"
          className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={11} /> /agent
        </Link>

        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldCheck size={11} className="text-emerald-500" />
          Spending policy · spending_policy program
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Your spending policy.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Stored as a PDA seeded by your wallet. Every agent purchase
          re-validates against these limits before USDC moves.
        </p>

        {loading && !policy && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={11} className="animate-spin" /> Reading policy from
            chain…
          </div>
        )}

        {policy && (
          <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider">
                Active · today
              </p>
              <a
                href={`https://explorer.solana.com/address/${policyAddr.toBase58()}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                {policyAddr.toBase58().slice(0, 12)}…
                <ExternalLink size={9} />
              </a>
            </div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-sm">
              <span className="font-semibold tabular-nums">
                ${spentUsd.toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                / ${policyMaxDailyUsd.toFixed(0)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
              ${(policyMaxDailyUsd - spentUsd).toFixed(2)} remaining today
            </p>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-border/60 bg-background p-5">
          <h2 className="mb-1 text-sm font-semibold">
            {policy ? "Update bounds" : "Initialize policy"}
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
            {policy
              ? "Adjusting any field re-writes the PDA on a single Phantom signature."
              : "Set the rails your agent operates inside. One Phantom signature creates the PDA. You can update later without re-creating."}
          </p>

          <div className="space-y-4">
            <Field
              label="Max per transaction"
              suffix="USDC"
              value={maxPerTx}
              onChange={setMaxPerTx}
              min={1}
              max={100_000}
              hint="Hard cap per single agent buy. The program rejects any tx exceeding this."
            />
            <Field
              label="Max per day"
              suffix="USDC"
              value={maxDaily}
              onChange={setMaxDaily}
              min={1}
              max={1_000_000}
              hint="Total spend cap per 24-hour rolling window."
            />
            <Field
              label="Auto-approve under"
              suffix="USDC"
              value={autoApprove}
              onChange={setAutoApprove}
              min={0}
              max={100_000}
              hint="Buys at or below this threshold settle without re-prompting."
            />

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/10 p-3 text-xs">
              <input
                type="checkbox"
                checked={secondhandFirst}
                onChange={(e) => setSecondhandFirst(e.target.checked)}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <span>
                <span className="font-semibold text-foreground">
                  Prefer secondhand
                </span>
                <span className="ml-2 text-muted-foreground">
                  Ranks Vestiaire / Grailed / TheRealReal above primary
                  retailers.
                </span>
              </span>
            </label>
          </div>

          {status && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px]">
              <Check size={11} className="text-emerald-500" />
              <span className="font-mono">{status}</span>
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-400">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              {policy ? "Update policy" : "Initialize policy"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              One Phantom signature · ~0.0001 SOL fee
            </p>
          </div>
        </section>

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          After your policy exists, head to{" "}
          <Link href="/agent" className="underline">
            /agent
          </Link>{" "}
          to enable real-time mode (session-key delegation) — the second
          prereq for auto-buy.
        </p>
      </main>
    </>
  );
}

function Field({
  label,
  suffix,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  hint: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2.5 transition-colors focus-within:border-foreground/40">
        <span className="text-xs text-muted-foreground">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className={cn(
            "flex-1 bg-transparent text-sm tabular-nums outline-none"
          )}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {suffix}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
