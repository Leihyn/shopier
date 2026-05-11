"use client";

import { useCallback, useEffect, useState } from "react";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Twin,
  TwinParams,
  TwinState,
  ixCreateTwin,
  ixUpdateTwin,
  ixDeleteTwin,
  ixInitPendingTwin,
  ixCompleteTwinEncrypted,
  ixUpdateTwinEncrypted,
  fetchTwin,
  fetchEncryptedTwin,
} from "@/lib/solana";
import { deriveTwinKey, encryptTwin, decryptTwin } from "@/lib/twinCrypto";

export type TwinSource = "legacy" | "encrypted" | "none";

// Tab-scoped cache for the derived twin encryption key. Without this, every
// page navigation re-mounts useTwin and re-prompts Phantom for signMessage —
// brutal UX. With this, the user signs once per tab session, then subsequent
// reads decrypt silently using the cached key. Cache is in-memory only;
// closing the tab clears it.
let cachedTwinKey: { ownerPubkey: string; key: Uint8Array } | null = null;

/**
 * Track whether we've already attempted decrypt for the current wallet in
 * this tab session. If we attempted and the user refused signMessage, we
 * don't keep re-prompting on every refresh — they'd hate us. The user can
 * explicitly retry by calling refresh() (e.g., /twin's load button).
 */
let attemptedDecryptForOwner: string | null = null;

export interface TwinHookState {
  twin: Twin | null; // resolved, decrypted-if-needed view
  source: TwinSource;
  loading: boolean;
  privacyEnabled: boolean;
  connected: boolean;
}

/**
 * Reads either the legacy plaintext twin OR the new encrypted twin.
 * If both exist, prefers encrypted (privacy wins). The decrypted twin
 * is held in component state only — never persisted, never sent to the server
 * unless the consumer explicitly sends it (e.g., decompose route).
 */
export function useTwin() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [twin, setTwin] = useState<Twin | null>(null);
  const [source, setSource] = useState<TwinSource>("none");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (opts?: { forcePrompt?: boolean }) => {
      if (!wallet.publicKey) {
        setTwin(null);
        setSource("none");
        return;
      }
      const ownerStr = wallet.publicKey.toBase58();
      setLoading(true);
      try {
        // Prefer encrypted; fall back to legacy
        const enc = await fetchEncryptedTwin(connection, wallet.publicKey);
        if (
          enc &&
          enc.state === TwinState.Encrypted &&
          enc.encryptedBlob.length > 0
        ) {
          // Set source eagerly so useSetupStatus's twinReady can resolve
          // without waiting on a signMessage prompt.
          setSource("encrypted");

          // Try cached key first — most page loads after the first one
          // hit this branch and skip Phantom entirely.
          let key: Uint8Array | null = null;
          if (cachedTwinKey?.ownerPubkey === ownerStr) {
            key = cachedTwinKey.key;
          } else if (wallet.signMessage) {
            // Don't auto-prompt on every refresh — only on the first
            // attempt for this owner OR when forcePrompt is set (e.g., the
            // /twin page explicitly requesting decryption).
            const shouldPrompt =
              opts?.forcePrompt || attemptedDecryptForOwner !== ownerStr;
            if (shouldPrompt) {
              attemptedDecryptForOwner = ownerStr;
              try {
                key = await deriveTwinKey((m) => wallet.signMessage!(m));
                cachedTwinKey = { ownerPubkey: ownerStr, key };
              } catch {
                // User refused — keep source = encrypted but twin = null.
                // Next refresh will not re-prompt unless forcePrompt is set.
                setTwin(null);
                return;
              }
            } else {
              // Subsequent silent refresh, no cached key, no force.
              // Twin stays opaque; source stays "encrypted".
              setTwin(null);
              return;
            }
          }

          if (key) {
            const params = decryptTwin(enc.encryptedBlob, enc.nonce, key);
            if (params) {
              setTwin({
                owner: wallet.publicKey,
                ...params,
                createdAt: enc.createdAt,
                updatedAt: enc.updatedAt,
              } as Twin);
              return;
            }
            // Bad key (shouldn't happen normally) — clear cache so a
            // forcePrompt retry can succeed.
            cachedTwinKey = null;
            setTwin(null);
            return;
          }
        }

        const legacy = await fetchTwin(connection, wallet.publicKey);
        if (legacy) {
          setTwin(legacy);
          setSource("legacy");
        } else {
          setTwin(null);
          setSource(enc ? "encrypted" : "none");
        }
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet.publicKey, wallet.signMessage]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Submit twin data. If `privacy` is true, writes to the encrypted PDA
   * (creating a pending twin first via treasury if needed). Otherwise writes
   * to the legacy plaintext PDA.
   */
  async function submit(params: TwinParams, privacy: boolean): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect wallet first");
    }
    if (!privacy) {
      // Legacy plaintext path
      const ix = twin && source === "legacy"
        ? ixUpdateTwin(wallet.publicKey, params)
        : ixCreateTwin(wallet.publicKey, params);
      return signAndSend([ix]);
    }

    // Privacy path
    if (!wallet.signMessage) {
      throw new Error(
        "This wallet does not support signMessage; cannot derive an encryption key. Try Phantom or Solflare."
      );
    }
    // Reuse the tab-cached key if we already derived it this session;
    // otherwise prompt and cache. This is the same key used for decryption
    // on read, so once we have it once, every subsequent save is silent.
    const ownerStr = wallet.publicKey.toBase58();
    let key: Uint8Array;
    if (cachedTwinKey?.ownerPubkey === ownerStr) {
      key = cachedTwinKey.key;
    } else {
      key = await deriveTwinKey((m) => wallet.signMessage!(m));
      cachedTwinKey = { ownerPubkey: ownerStr, key };
    }
    const { blob, nonce } = encryptTwin(params, key);

    // Three cases for the encrypted twin PDA:
    //   1. Doesn't exist        → user paymasters their own init + completes in one tx
    //   2. Exists, Pending      → user just completes (treasury or someone else paid for init)
    //   3. Exists, Encrypted    → user updates (overwrites blob+nonce in place)
    const enc = await fetchEncryptedTwin(connection, wallet.publicKey);
    if (!enc) {
      // Self-init: user pays for their own pending PDA + completes in the same tx.
      // The on-chain program's `init_pending_twin` only requires `paymaster` to
      // be a signer — there's no constraint that paymaster ≠ owner, so the user
      // can be both. Net cost to the user: ~0.002 SOL rent + one signature.
      const initIx = ixInitPendingTwin(wallet.publicKey, wallet.publicKey);
      const completeIx = ixCompleteTwinEncrypted(wallet.publicKey, blob, nonce);
      return signAndSend([initIx, completeIx]);
    }
    if (enc.state === TwinState.Encrypted) {
      return signAndSend([ixUpdateTwinEncrypted(wallet.publicKey, blob, nonce)]);
    }
    // Pending → just complete it
    return signAndSend([ixCompleteTwinEncrypted(wallet.publicKey, blob, nonce)]);
  }

  async function destroy(): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect wallet first");
    }
    if (source !== "legacy") {
      throw new Error(
        "Only legacy plaintext twins can be deleted via this path. Encrypted twin deletion is not yet implemented."
      );
    }
    return signAndSend([ixDeleteTwin(wallet.publicKey)]);
  }

  async function signAndSend(
    ixs: ReturnType<typeof ixCreateTwin>[]
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect wallet first");
    }
    const tx = new Transaction().add(...ixs);
    tx.feePayer = wallet.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    await refresh();
    return sig;
  }

  return {
    twin,
    source,
    loading,
    connected: !!wallet.publicKey,
    submit,
    destroy,
    refresh,
  };
}
