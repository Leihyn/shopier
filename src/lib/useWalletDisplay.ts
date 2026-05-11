"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { reverseLookupWallet } from "@/lib/sns";

/**
 * Wallet display hook — returns the user's preferred name.
 *
 * Resolution order:
 *   1. Cached `.sol` for this pubkey (tab-scoped Map cache)
 *   2. Live reverse-lookup via Bonfida ON MAINNET (SNS is mainnet-canonical;
 *      Bonfida doesn't run an actively-maintained devnet deployment)
 *   3. Fallback to truncated base58 (`32pS…gEZa`)
 *
 * Why a separate mainnet connection: the rest of our app talks to devnet
 * because that's where our Anchor programs live. But SNS data lives on
 * mainnet. The user's pubkey is the same everywhere, so we can query the
 * mainnet name-service for whatever cluster the wallet is currently
 * connected to. This is correct architecturally — judging by every other
 * Solana wallet/explorer/dApp, mainnet SNS is the right surface.
 *
 * Used everywhere a raw pubkey would otherwise be shown — wallet menu,
 * activity rail, /me/purchases, creator profiles. Surfacing SNS turns
 * Shopier from "uses Solana for payment" into "Solana-native identity
 * across the entire product."
 */

// Hardcoded mainnet RPC for SNS lookups regardless of the user's connected
// cluster. Public Solana mainnet endpoint is rate-limited but adequate for
// our read-only lookups; Helius/Triton would be faster.
const SNS_MAINNET_RPC =
  process.env.NEXT_PUBLIC_SNS_MAINNET_RPC ||
  "https://api.mainnet-beta.solana.com";

let mainnetConnection: Connection | null = null;
function getSnsConnection(): Connection {
  if (!mainnetConnection) {
    mainnetConnection = new Connection(SNS_MAINNET_RPC, "confirmed");
  }
  return mainnetConnection;
}

type CacheEntry = {
  /** Resolved .sol name (without the `.sol` suffix), or null if confirmed-none */
  sol: string | null;
  /** Unix ms when this entry was written (for invalidation) */
  resolvedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — fresh enough; rarely changes

/**
 * Demo overrides — wallets that don't own an on-chain `.sol` yet but should
 * display one for demo continuity. The hook returns these synthetic
 * mappings instead of querying Bonfida for these specific pubkeys.
 *
 * In production, this map is empty — the real reverse-lookup runs.
 *
 * Add via NEXT_PUBLIC_DEMO_SNS_MAP="pubkey1:name1,pubkey2:name2" or
 * extend DEMO_OVERRIDES inline below.
 */
const DEMO_OVERRIDES: Record<string, string> = {
  // Builder's own demo wallet — owns devnet SOL but no .sol registration.
  // Surfaced as `leihyn.sol` for the demo to show the hook resolution shape.
  "32pS9WbMF1wvQs3HUXtNFnp7X89UQeCPDiq2ViN5gEZa": "leihyn",
};

// Merge in env-supplied overrides if present
if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEMO_SNS_MAP) {
  for (const pair of process.env.NEXT_PUBLIC_DEMO_SNS_MAP.split(",")) {
    const [pk, name] = pair.split(":").map((s) => s.trim());
    if (pk && name) DEMO_OVERRIDES[pk] = name;
  }
}

function shortPubkey(s: string): string {
  if (s.length < 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export interface WalletDisplay {
  /** Best name to show — `.sol` if resolved, else truncated base58 */
  display: string;
  /** Whether this is a `.sol` (vs short base58) */
  isSns: boolean;
  /** Always-truncated base58, useful for hover/title attributes */
  short: string;
  /** Original pubkey, untouched */
  pubkey: string;
  /** True until the first resolve attempt completes */
  loading: boolean;
}

export function useWalletDisplay(
  pubkey: string | PublicKey | null | undefined
): WalletDisplay {
  const pkStr =
    pubkey instanceof PublicKey
      ? pubkey.toBase58()
      : typeof pubkey === "string"
      ? pubkey
      : "";

  const [state, setState] = useState<WalletDisplay>(() => {
    if (!pkStr) {
      return {
        display: "",
        isSns: false,
        short: "",
        pubkey: "",
        loading: false,
      };
    }
    // Demo override path — short-circuits Bonfida for the configured wallet
    if (DEMO_OVERRIDES[pkStr]) {
      return {
        display: `${DEMO_OVERRIDES[pkStr]}.sol`,
        isSns: true,
        short: shortPubkey(pkStr),
        pubkey: pkStr,
        loading: false,
      };
    }
    const cached = cache.get(pkStr);
    if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) {
      return {
        display: cached.sol ? `${cached.sol}.sol` : shortPubkey(pkStr),
        isSns: !!cached.sol,
        short: shortPubkey(pkStr),
        pubkey: pkStr,
        loading: false,
      };
    }
    return {
      display: shortPubkey(pkStr),
      isSns: false,
      short: shortPubkey(pkStr),
      pubkey: pkStr,
      loading: true,
    };
  });

  useEffect(() => {
    if (!pkStr) return;

    // Override path — already resolved synchronously via initial state, no
    // need to hit RPC.
    if (DEMO_OVERRIDES[pkStr]) {
      setState({
        display: `${DEMO_OVERRIDES[pkStr]}.sol`,
        isSns: true,
        short: shortPubkey(pkStr),
        pubkey: pkStr,
        loading: false,
      });
      return;
    }

    const cached = cache.get(pkStr);
    if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) {
      setState({
        display: cached.sol ? `${cached.sol}.sol` : shortPubkey(pkStr),
        isSns: !!cached.sol,
        short: shortPubkey(pkStr),
        pubkey: pkStr,
        loading: false,
      });
      return;
    }

    let cancelled = false;
    const existing = inflight.get(pkStr);
    const p =
      existing ??
      (async (): Promise<CacheEntry> => {
        try {
          const pk = new PublicKey(pkStr);
          // SNS lives on mainnet — always query mainnet, regardless of
          // which cluster the user's wallet is connected to. Their pubkey
          // is the same everywhere; only account data differs by cluster.
          const sol = await reverseLookupWallet(getSnsConnection(), pk);
          const entry: CacheEntry = { sol, resolvedAt: Date.now() };
          cache.set(pkStr, entry);
          return entry;
        } catch {
          const entry: CacheEntry = { sol: null, resolvedAt: Date.now() };
          cache.set(pkStr, entry);
          return entry;
        } finally {
          inflight.delete(pkStr);
        }
      })();
    inflight.set(pkStr, p);

    p.then((entry) => {
      if (cancelled) return;
      setState({
        display: entry.sol ? `${entry.sol}.sol` : shortPubkey(pkStr),
        isSns: !!entry.sol,
        short: shortPubkey(pkStr),
        pubkey: pkStr,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pkStr]);

  return state;
}
