"use client";

import { useState, useEffect } from "react";
import {
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Send,
  Loader2,
  Check,
  AlertTriangle,
  AtSign,
  ExternalLink,
} from "lucide-react";
import {
  resolveSnsName,
  normalizeSnsLabel,
} from "@/lib/sns";
import {
  USDC_MINT_DEVNET,
  toStableUnits,
} from "@/lib/solana";
import { Connection } from "@solana/web3.js";

const SNS_MAINNET_RPC =
  process.env.NEXT_PUBLIC_SNS_MAINNET_RPC ||
  "https://api.mainnet-beta.solana.com";

let snsConnection: Connection | null = null;
function getSnsConnection() {
  if (!snsConnection) snsConnection = new Connection(SNS_MAINNET_RPC, "confirmed");
  return snsConnection;
}

/**
 * Send-to-name form — type a `.sol`, see it resolve, send USDC.
 *
 * The forward-lookup hits mainnet (where SNS lives); the actual transfer
 * runs on whatever cluster the wallet is connected to. The same pubkey owns
 * the name on mainnet AND has token accounts on devnet — Solana wallets are
 * cross-cluster identical at the keypair level.
 *
 * For the demo this is mounted on /me/purchases as a "Tip a creator" surface.
 * v1: route through the bridge dispatcher so Lagos users tip in NGN-converted
 * USDC.
 */
export default function SendToName() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(5);
  const [resolved, setResolved] = useState<{
    pubkey: PublicKey | null;
    error: string | null;
    loading: boolean;
  }>({ pubkey: null, error: null, loading: false });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    sig: string;
    label: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounced resolution as user types
  useEffect(() => {
    const label = normalizeSnsLabel(name);
    if (!label) {
      setResolved({ pubkey: null, error: null, loading: false });
      return;
    }
    setResolved((s) => ({ ...s, loading: true, error: null }));
    const id = setTimeout(async () => {
      try {
        const pk = await resolveSnsName(getSnsConnection(), label);
        if (pk) {
          setResolved({ pubkey: pk, error: null, loading: false });
        } else {
          setResolved({
            pubkey: null,
            error: `${label}.sol is not registered`,
            loading: false,
          });
        }
      } catch (e) {
        setResolved({
          pubkey: null,
          error: (e as Error).message,
          loading: false,
        });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [name]);

  async function send() {
    if (!wallet.publicKey || !wallet.signTransaction || !resolved.pubkey)
      return;
    setSubmitting(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const mint = USDC_MINT_DEVNET;
      const fromAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const toAta = getAssociatedTokenAddressSync(mint, resolved.pubkey);
      const baseUnits = toStableUnits(amount);

      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          toAta,
          resolved.pubkey,
          mint
        ),
        createTransferInstruction(
          fromAta,
          toAta,
          wallet.publicKey,
          baseUnits
        )
      );
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
      setStatus({
        sig,
        label: `Sent $${amount} USDC to ${normalizeSnsLabel(name)}.sol`,
      });
      setName("");
      setAmount(5);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!wallet.publicKey) return null;

  const canSend =
    !!resolved.pubkey && amount > 0 && !submitting && !resolved.loading;
  const inputLabel = normalizeSnsLabel(name);

  return (
    <section className="rounded-2xl border border-border/60 bg-background p-5">
      <div className="mb-4">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <AtSign size={10} />
          Send by name
        </p>
        <h2 className="font-display text-base font-bold tracking-tight">
          Tip or pay a `.sol` directly
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Type any{" "}
          <code className="font-mono">.sol</code>; we resolve it via Bonfida
          and route a USDC transfer to whatever wallet owns the name right now.
        </p>
      </div>

      <div className="space-y-3">
        {/* Name input */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Recipient
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2.5 transition-colors focus-within:border-foreground/40">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. bonfida"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <span className="font-mono text-[11px] text-muted-foreground">
              .sol
            </span>
          </div>
          {/* Resolution row */}
          {inputLabel && (
            <div className="mt-1.5 text-[10px]">
              {resolved.loading && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 size={9} className="animate-spin" />
                  Resolving {inputLabel}.sol…
                </span>
              )}
              {!resolved.loading && resolved.pubkey && (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <Check size={9} />
                  Owned by{" "}
                  <code className="font-mono">
                    {resolved.pubkey.toBase58().slice(0, 4)}…
                    {resolved.pubkey.toBase58().slice(-4)}
                  </code>
                </span>
              )}
              {!resolved.loading && resolved.error && (
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={9} />
                  {resolved.error}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Amount
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2.5 transition-colors focus-within:border-foreground/40">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              type="number"
              value={amount}
              min={0.01}
              step={0.01}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="flex-1 bg-transparent text-sm tabular-nums outline-none"
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              USDC
            </span>
          </div>
        </div>

        {/* Send button + result rows */}
        {status && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px]">
            <Check size={11} className="text-emerald-500" />
            <span className="flex-1 font-mono">{status.label}</span>
            <a
              href={`https://explorer.solana.com/tx/${status.sig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
            >
              tx <ExternalLink size={9} />
            </a>
          </div>
        )}
        {submitError && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-400">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span className="break-all">{submitError}</span>
          </div>
        )}
        <button
          onClick={send}
          disabled={!canSend}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          Send ${amount} USDC to {inputLabel || "…"}.sol
        </button>
      </div>
    </section>
  );
}
