"use client";

import { useCallback, useEffect, useState } from "react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ixSetDelegate,
  ixRevokeDelegate,
  fetchDelegation,
  toStableUnits,
  type DelegationInfo,
} from "@/lib/solana";
import {
  newSessionKeypair,
  encryptSessionSecret,
  deriveSessionEncryptionKey,
  storeSession,
  readPersistedSession,
  clearSession,
  defaultExpiresAtUnix,
  type PersistedSession,
} from "@/lib/sessionKey";

export interface SessionDelegateState {
  loading: boolean;
  /** Local persisted session metadata (or null) */
  persisted: PersistedSession | null;
  /** On-chain delegation info (or null) */
  onChain: DelegationInfo | null;
  /** True when both local + on-chain agree and not expired */
  active: boolean;
}

export function useSessionDelegate() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [state, setState] = useState<SessionDelegateState>({
    loading: true,
    persisted: null,
    onChain: null,
    active: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setState({ loading: false, persisted: null, onChain: null, active: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const ownerB58 = wallet.publicKey.toBase58();
    const persisted = readPersistedSession(ownerB58);
    let onChain: DelegationInfo | null = null;
    try {
      onChain = await fetchDelegation(connection, wallet.publicKey);
    } catch {
      // ignore
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    const active =
      !!persisted &&
      !!onChain &&
      onChain.delegate.toBase58() === persisted.delegatePubkey &&
      onChain.expiresAt > now;
    setState({ loading: false, persisted, onChain, active });
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Enable real-time shopping. Two wallet interactions:
   *  1. signMessage to derive encryption key
   *  2. signTransaction for the on-chain set_delegate ix
   */
  async function enable(opts: {
    maxPerTxUsd: number;
    maxDailyUsd: number;
    durationHours?: number;
  }): Promise<void> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signMessage) {
      throw new Error("Connect Phantom (and ensure it supports signMessage)");
    }
    setBusy(true);
    setError(null);
    try {
      const owner = wallet.publicKey;
      const ownerB58 = owner.toBase58();

      // 1. Generate session keypair + derive encryption key
      const sessionKp = newSessionKeypair();
      const encryptionKey = await deriveSessionEncryptionKey((m) =>
        wallet.signMessage!(m)
      );
      const { encryptedSecret, nonce } = encryptSessionSecret(sessionKp, encryptionKey);

      const expiresAt = opts.durationHours
        ? Math.floor(Date.now() / 1000) + opts.durationHours * 60 * 60
        : defaultExpiresAtUnix();

      // 2. Build + sign the set_delegate transaction
      const tx = new Transaction().add(
        ixSetDelegate(
          owner,
          sessionKp.publicKey,
          toStableUnits(opts.maxPerTxUsd),
          toStableUnits(opts.maxDailyUsd),
          BigInt(expiresAt)
        )
      );
      tx.feePayer = owner;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      // 3. Persist locally only after on-chain confirmation
      storeSession(ownerB58, sessionKp, encryptedSecret, nonce, expiresAt);

      await refresh();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  /** Revoke: close on-chain delegation account + wipe local session blob. */
  async function revoke(): Promise<void> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect Phantom");
    }
    setBusy(true);
    setError(null);
    try {
      const owner = wallet.publicKey;
      const tx = new Transaction().add(ixRevokeDelegate(owner));
      tx.feePayer = owner;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      clearSession();
      await refresh();
    } catch (err) {
      // Even if the on-chain revoke fails, wipe the local blob — a stranded
      // session key with no on-chain delegation is harmless.
      clearSession();
      setError((err as Error).message);
      await refresh();
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, error, enable, revoke, refresh };
}
