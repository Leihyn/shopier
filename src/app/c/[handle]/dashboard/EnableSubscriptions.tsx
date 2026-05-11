"use client";

import { useEffect, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  fetchStylistProfile,
  ixCreateStylistProfile,
  USDC_MINT_DEVNET,
  toStableUnits,
  fromStableUnits,
  type StylistProfile,
} from "@/lib/solana";
import { Loader2 } from "lucide-react";

/**
 * Inline subscription-setup for creators on their own dashboard.
 * Reads the on-chain StylistProfile PDA at the creator's wallet; if absent,
 * shows a form to register one. If present, shows current fee + subscriber count.
 */
export default function EnableSubscriptions({
  creatorPubkey,
  creatorHandle,
  bio,
}: {
  creatorPubkey: string;
  creatorHandle: string;
  bio: string;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [profile, setProfile] = useState<StylistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fee, setFee] = useState(10);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchStylistProfile(
          connection,
          new PublicKey(creatorPubkey)
        );
        if (!cancelled) setProfile(p);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, creatorPubkey]);

  const isOwner =
    wallet.publicKey && wallet.publicKey.toBase58() === creatorPubkey;

  async function onEnable() {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    if (!isOwner) {
      setStatus("Connect the creator's wallet to enable subscriptions.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const stylist = wallet.publicKey;
      const payoutAta = getAssociatedTokenAddressSync(USDC_MINT_DEVNET, stylist);

      const tx = new Transaction();
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          stylist,
          payoutAta,
          stylist,
          USDC_MINT_DEVNET,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      tx.add(
        ixCreateStylistProfile(
          stylist,
          payoutAta,
          creatorHandle,
          bio,
          toStableUnits(fee)
        )
      );

      tx.feePayer = stylist;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      setStatus(`Subscriptions enabled. Tx: ${sig.slice(0, 12)}…`);
      const fresh = await fetchStylistProfile(connection, stylist);
      setProfile(fresh);
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-background p-5 text-xs text-muted-foreground">
        <Loader2 size={12} className="mr-2 inline-block animate-spin" />
        Checking on-chain subscription state…
      </div>
    );
  }

  if (profile) {
    return (
      <div className="rounded-xl border border-border/60 bg-background p-5">
        <p className="text-sm font-semibold">Subscriptions live</p>
        <p className="mt-1 text-xs text-muted-foreground">
          ${fromStableUnits(profile.feePerMonth).toFixed(2)} / month ·{" "}
          {profile.subscriberCount} subscriber
          {profile.subscriberCount === 1 ? "" : "s"} · payout to{" "}
          <code className="text-[10px]">
            {profile.payoutTokenAccount.toBase58().slice(0, 8)}…
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-5">
      <p className="text-sm font-semibold">Enable subscriptions</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Optional. Lets viewers subscribe to your curated feed for a monthly fee.
        90% to you, 10% platform. Settled via the marketplace Anchor program.
      </p>
      <div className="mt-4">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
          Monthly fee — ${fee} USDC
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={fee}
          onChange={(e) => setFee(Number(e.target.value))}
          className="w-full"
          disabled={!isOwner}
        />
      </div>
      {status && (
        <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs">{status}</p>
      )}
      <button
        onClick={onEnable}
        disabled={saving || !isOwner}
        className="mt-4 flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {isOwner ? "Enable subscriptions" : "Connect this creator's wallet"}
      </button>
    </div>
  );
}
