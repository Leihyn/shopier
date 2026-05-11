"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PublicKey,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/layout/Navbar";
import {
  Loader2,
  ExternalLink,
  Receipt,
  RefreshCw,
  Wallet,
  PieChart,
} from "lucide-react";
import { useWalletDisplay } from "@/lib/useWalletDisplay";
import SendToName from "@/components/sns/SendToName";
import ZerionInsights from "@/components/me/ZerionInsights";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const SPENDING_POLICY_ID = "2S7hJm57s4VBmBBpqe59XFFibKR9L2ykstMCm8xWreRt";
const DIGITAL_TWIN_ID = "Dt3SWQmsAT1vDJyPRCPgMPXi2Rg47niXDVUzo6boFBCU";
const STYLIST_MARKETPLACE_ID = "G5FE1NnanqQJGNCyqLnKqKonYFWVzyzoAeZ9rUtf8F5e";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

type EntryKind = "purchase" | "policy" | "twin" | "stylist" | "transfer" | "other";

interface Entry {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
  kind: EntryKind;
  programs: string[];
  /** USDC amount in human units, if discoverable */
  usdcDelta?: number;
}

/**
 * /me/purchases — wallet-scoped activity reader.
 *
 * Fetches the last 20 signatures for the connected wallet and parses each
 * transaction to identify what kind of action it was: a purchase via the
 * spending_policy program, a twin update, a stylist subscription, an SPL
 * transfer, or other. Renders inline with links to Solana Explorer.
 *
 * Pulled from devnet RPC directly — no third-party indexer needed.
 * Covalent's devnet support is patchy; getSignaturesForAddress is universal.
 */
interface PortfolioBalance {
  ticker: string;
  balance: number;
  quoteUsd: number;
}

export default function PurchasesPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const display = useWalletDisplay(wallet.publicKey?.toBase58() ?? null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<{
    configured: boolean;
    total: number;
    balances: PortfolioBalance[];
    isDemoFallback?: boolean;
    sourceWallet?: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const sigs = await connection.getSignaturesForAddress(
        wallet.publicKey,
        { limit: 20 },
        "confirmed"
      );
      if (sigs.length === 0) {
        setEntries([]);
        return;
      }
      const txs = await connection.getParsedTransactions(
        sigs.map((s: ConfirmedSignatureInfo) => s.signature),
        { commitment: "confirmed", maxSupportedTransactionVersion: 0 }
      );
      const out: Entry[] = sigs.map((s, i) => parseEntry(s, txs[i]));
      setEntries(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch Covalent portfolio summary independently — graceful no-op if key missing
  useEffect(() => {
    if (!wallet.publicKey) {
      setPortfolio(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/me/portfolio?wallet=${wallet.publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPortfolio(data);
      })
      .catch(() => {
        /* swallow */
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.publicKey]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:pb-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Wallet activity
              {display.isSns && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-700 dark:text-emerald-400">
                  {display.display}
                </span>
              )}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Your purchases</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Last 20 signatures involving{" "}
              <span
                className={
                  display.isSns ? "font-medium text-foreground" : "font-mono"
                }
                title={display.pubkey}
              >
                {display.display}
              </span>{" "}
              on devnet, parsed against Shopier&apos;s programs.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading || !wallet.publicKey}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Refresh
          </button>
        </header>

        {!wallet.publicKey && (
          <EmptyState
            icon={Wallet}
            title="Connect your wallet"
            body="Connect Phantom (top right) to see your purchase history, portfolio, and recent activity."
            size="lg"
          />
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Portfolio summary — Covalent indexer */}
        {wallet.publicKey && portfolio && portfolio.configured && (
          <section className="mb-6 rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <PieChart size={11} className="text-emerald-500" />
                Portfolio · indexed by Covalent
                {portfolio.isDemoFallback && (
                  <span
                    className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[8px] text-amber-700 dark:text-amber-400"
                    title={`Connected wallet has no mainnet activity; viewing demo wallet ${portfolio.sourceWallet?.slice(0, 6)}…`}
                  >
                    demo wallet
                  </span>
                )}
              </div>
              <span className="font-mono text-base font-bold tabular-nums">
                ${portfolio.total.toFixed(2)}
              </span>
            </div>
            {portfolio.balances.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {portfolio.balances.slice(0, 3).map((b) => (
                  <div
                    key={b.ticker}
                    className="rounded-lg border border-border/40 bg-muted/20 p-2"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {b.ticker}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                      {b.balance.toFixed(b.balance < 1 ? 4 : 2)}
                    </p>
                    {b.quoteUsd > 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        ≈ ${b.quoteUsd.toFixed(2)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No indexed balances yet on this wallet.
              </p>
            )}
          </section>
        )}

        {/* Send to .sol — SNS forward lookup powered tip flow */}
        {wallet.publicKey && (
          <div className="mb-6">
            <SendToName />
          </div>
        )}

        {/* Zerion wallet insights — live API call */}
        {wallet.publicKey && (
          <div className="mb-6">
            <ZerionInsights wallet={wallet.publicKey.toBase58()} />
          </div>
        )}

        {wallet.publicKey && !loading && entries.length === 0 && !error && (
          <EmptyState
            icon={Receipt}
            title="No activity yet"
            body="Drop a screenshot in the agent or watch a celebrity. Your first transaction will land here."
            cta={{ label: "Browse trending", href: "/trending" }}
            size="lg"
          />
        )}

        {wallet.publicKey && loading && entries.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => (
              <EntryRow key={e.signature} entry={e} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function parseEntry(
  sig: ConfirmedSignatureInfo,
  tx: ParsedTransactionWithMeta | null
): Entry {
  const programs: string[] = [];
  let kind: EntryKind = "other";
  let usdcDelta: number | undefined;

  if (tx?.transaction.message.instructions) {
    for (const ix of tx.transaction.message.instructions) {
      const pk = "programId" in ix ? ix.programId.toBase58() : "";
      if (pk) programs.push(pk);
      if (pk === SPENDING_POLICY_ID) kind = "purchase";
      else if (pk === DIGITAL_TWIN_ID && kind === "other") kind = "twin";
      else if (pk === STYLIST_MARKETPLACE_ID && kind === "other") kind = "stylist";
      else if (pk === TOKEN_PROGRAM_ID && kind === "other") kind = "transfer";
    }
  }

  // Parse USDC delta from token balance change
  if (tx?.meta?.preTokenBalances && tx?.meta?.postTokenBalances) {
    for (let i = 0; i < tx.meta.preTokenBalances.length; i++) {
      const pre = tx.meta.preTokenBalances[i];
      const post = tx.meta.postTokenBalances.find(
        (p) => p.accountIndex === pre.accountIndex
      );
      if (
        pre.mint === USDC_DEVNET &&
        post &&
        pre.uiTokenAmount.uiAmount !== null &&
        post.uiTokenAmount.uiAmount !== null
      ) {
        const d = post.uiTokenAmount.uiAmount - pre.uiTokenAmount.uiAmount;
        if (Math.abs(d) > 0.001 && (usdcDelta === undefined || Math.abs(d) > Math.abs(usdcDelta))) {
          usdcDelta = d;
        }
      }
    }
  }

  if (kind === "transfer" && usdcDelta !== undefined && usdcDelta < 0) {
    kind = "purchase"; // outbound USDC = a buy by definition
  }

  return {
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime ?? null,
    err: sig.err,
    kind,
    programs: Array.from(new Set(programs)),
    usdcDelta,
  };
}

function EntryRow({ entry }: { entry: Entry }) {
  const tone =
    entry.kind === "purchase"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : entry.kind === "twin"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : entry.kind === "stylist"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border bg-background";
  const label =
    entry.kind === "purchase"
      ? "Purchase"
      : entry.kind === "twin"
      ? "Twin update"
      : entry.kind === "stylist"
      ? "Stylist"
      : entry.kind === "transfer"
      ? "Transfer"
      : "Other";
  const time = entry.blockTime
    ? new Date(entry.blockTime * 1000).toLocaleString()
    : "—";

  return (
    <a
      href={`https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40 ${tone}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
            {label}
          </span>
          {entry.err ? (
            <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-rose-700 dark:text-rose-400">
              failed
            </span>
          ) : null}
          {entry.usdcDelta !== undefined && (
            <span
              className={`font-mono text-xs tabular-nums ${
                entry.usdcDelta < 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {entry.usdcDelta > 0 ? "+" : ""}
              {entry.usdcDelta.toFixed(2)} USDC
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">{entry.signature.slice(0, 18)}…</span>
          <span>· slot {entry.slot.toLocaleString()}</span>
          <span>· {time}</span>
        </div>
      </div>
      <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
    </a>
  );
}
