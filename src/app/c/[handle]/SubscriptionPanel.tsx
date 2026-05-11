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
  ixSubscribe,
  USDC_MINT_DEVNET,
  fromStableUnits,
  type StylistProfile,
} from "@/lib/solana";
import { Loader2, Sparkles } from "lucide-react";

const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
    "11111111111111111111111111111112"
);

export default function SubscriptionPanel({
  creatorPubkey,
  creatorHandle,
}: {
  creatorPubkey: string;
  creatorHandle: string;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [profile, setProfile] = useState<StylistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchStylistProfile(connection, new PublicKey(creatorPubkey));
        if (!cancelled) setProfile(p);
      } catch {
        // No on-chain profile — creator only does referrals
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, creatorPubkey]);

  async function onSubscribe() {
    if (!wallet.publicKey || !wallet.signTransaction || !profile) return;
    setSubscribing(true);
    setStatus(null);
    try {
      const subscriber = wallet.publicKey;
      const stylistKey = new PublicKey(creatorPubkey);
      const subAta = getAssociatedTokenAddressSync(USDC_MINT_DEVNET, subscriber);
      const treasuryAta = getAssociatedTokenAddressSync(USDC_MINT_DEVNET, TREASURY);

      const tx = new Transaction();
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          subscriber,
          subAta,
          subscriber,
          USDC_MINT_DEVNET,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          subscriber,
          treasuryAta,
          TREASURY,
          USDC_MINT_DEVNET,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      tx.add(
        ixSubscribe(
          subscriber,
          stylistKey,
          subAta,
          profile.payoutTokenAccount,
          treasuryAta
        )
      );

      tx.feePayer = subscriber;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      setStatus(`Subscribed. Tx: ${sig.slice(0, 12)}…`);
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setSubscribing(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" />
        Checking @{creatorHandle}&apos;s subscription offer…
      </div>
    );
  }
  if (!profile) {
    return null; // No subscription offered; the page just shows referral mode
  }

  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-background p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold">Subscribe to @{creatorHandle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ${fromStableUnits(profile.feePerMonth).toFixed(2)} / month · 90% to creator, 10% platform · 30-day period
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {profile.subscriberCount} subscriber{profile.subscriberCount === 1 ? "" : "s"}
        </span>
      </div>
      {status && (
        <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <Sparkles size={12} className="mr-1.5 inline-block text-muted-foreground" />
          {status}
        </p>
      )}
      <button
        onClick={onSubscribe}
        disabled={subscribing || !wallet.publicKey}
        className="mt-4 flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {subscribing && <Loader2 size={14} className="animate-spin" />}
        {wallet.publicKey ? "Subscribe" : "Connect wallet to subscribe"}
      </button>
    </div>
  );
}
