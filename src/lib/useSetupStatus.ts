"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  fetchPolicy,
  fetchDelegation,
  type PolicyConfig,
  type DelegationInfo,
} from "@/lib/solana";
import { useTwin } from "@/lib/useTwin";

/**
 * Setup-readiness aggregator.
 *
 * The agent demo flow has five prereqs that must hold before auto-buy works:
 *   1. Wallet connected
 *   2. Twin exists (legacy or encrypted)
 *   3. Spending policy initialized
 *   4. Real-time delegation active (set_delegate, unexpired)
 *   5. At least one watch created
 *
 * This hook polls each one and exposes both the booleans and a `completed`
 * count so the SetupStatusWidget can render a checklist + progress bar.
 *
 * Polls every 15 seconds while the wallet is connected. Re-fires immediately
 * on wallet change.
 */

export interface SetupStatus {
  walletConnected: boolean;
  twinReady: boolean;
  policyReady: boolean;
  realTimeReady: boolean;
  watchCreated: boolean;
  allReady: boolean;
  completed: number;
  total: number;
  /** Triggers a refresh on demand — useful after a user just completed a step. */
  refresh: () => void;
}

export function useSetupStatus(): SetupStatus {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { source } = useTwin();
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [delegation, setDelegation] = useState<DelegationInfo | null>(null);
  const [watchCount, setWatchCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setPolicy(null);
      setDelegation(null);
      setWatchCount(0);
      return;
    }
    const pk = wallet.publicKey;
    try {
      const [p, d, watchRes] = await Promise.all([
        fetchPolicy(connection, pk).catch(() => null),
        fetchDelegation(connection, pk).catch(() => null),
        fetch(`/api/watches?wallet=${pk.toBase58()}`)
          .then((r) => r.json())
          .then((d: { watches?: unknown[] }) => d.watches?.length ?? 0)
          .catch(() => 0),
      ]);
      setPolicy(p);
      setDelegation(d);
      setWatchCount(watchRes);
    } catch {
      /* swallow */
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const realTimeActive = !!delegation && delegation.expiresAt > nowSec;

  const checks = [
    !!wallet.publicKey,
    source !== "none",
    !!policy,
    realTimeActive,
    watchCount > 0,
  ];

  return {
    walletConnected: checks[0],
    twinReady: checks[1],
    policyReady: checks[2],
    realTimeReady: checks[3],
    watchCreated: checks[4],
    allReady: checks.every(Boolean),
    completed: checks.filter(Boolean).length,
    total: checks.length,
    refresh,
  };
}
