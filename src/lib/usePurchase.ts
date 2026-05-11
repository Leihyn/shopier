"use client";

import {
  Transaction,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  toStableUnits,
  ixCheckSpend,
  ixRecordSpend,
  ixRecordSpendAsDelegate,
  fetchPolicy,
  fetchDelegation,
  policyPda,
  dailyPda,
  mintForSymbol,
  type StableSymbol,
} from "@/lib/solana";
import { unlockSession, readPersistedSession } from "@/lib/sessionKey";

const MERCHANT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ||
    "11111111111111111111111111111112" // placeholder, override in .env.local
);

export interface PurchaseResult {
  signature: string;
  autoApproved: boolean;
  amountUsdc: number;
  symbol: StableSymbol;
  explorerUrl: string;
  /** True when the tx was signed by the session key (no Phantom popup) */
  signedByDelegate: boolean;
}

/** Cached unlocked session keypair, lives only in memory for the tab session */
let cachedSessionKp: { ownerPubkey: string; kp: Keypair } | null = null;

export function usePurchase() {
  const { connection } = useConnection();
  const wallet = useWallet();

  /**
   * Settle a purchase in the chosen stablecoin.
   * Spending policy enforces unit limits regardless of mint —
   * 1 USDC unit and 1 USDT unit both count as 1 USD-equivalent.
   */
  async function purchase(
    amountUsd: number,
    symbol: StableSymbol = "USDC"
  ): Promise<PurchaseResult> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect wallet to make a purchase");
    }
    const owner = wallet.publicKey;
    const amount = toStableUnits(amountUsd);
    const mint = mintForSymbol(symbol);

    // Verify policy exists
    const policy = await fetchPolicy(connection, owner);
    if (!policy) {
      throw new Error(
        "No spending policy found for this wallet. Initialize one before purchasing."
      );
    }
    if (amount > policy.maxPerTx) {
      throw new Error(
        `$${amountUsd} exceeds max per transaction ($${
          Number(policy.maxPerTx) / 1_000_000
        })`
      );
    }

    // Simulate check_spend to surface the auto-approve bool + any hard-limit reverts
    const sim = await simulate(connection, owner, amount);
    if ("error" in sim) {
      throw new Error(`Spending policy rejected: ${sim.error}`);
    }
    const autoApproved = sim.autoApproved;

    // ----------------------------------------------------------------
    // Real-time path: try session-key delegation first
    // ----------------------------------------------------------------
    let signedByDelegate = false;
    let signature: string;

    const persisted = readPersistedSession(owner.toBase58());
    const delegation = persisted ? await fetchDelegation(connection, owner) : null;
    const sessionEligible =
      persisted &&
      delegation &&
      delegation.delegate.toBase58() === persisted.delegatePubkey &&
      amount <= delegation.maxPerTx &&
      delegation.expiresAt > BigInt(Math.floor(Date.now() / 1000));

    const fromAta = getAssociatedTokenAddressSync(mint, owner);
    const toAta = getAssociatedTokenAddressSync(mint, MERCHANT_ADDRESS);

    if (sessionEligible) {
      // Try to use the cached session key, or unlock it.
      let sessionKp = cachedSessionKp?.ownerPubkey === owner.toBase58()
        ? cachedSessionKp.kp
        : null;
      if (!sessionKp && wallet.signMessage) {
        try {
          const unlocked = await unlockSession(
            owner.toBase58(),
            (m) => wallet.signMessage!(m)
          );
          if (unlocked) {
            sessionKp = unlocked;
            cachedSessionKp = { ownerPubkey: owner.toBase58(), kp: unlocked };
          }
        } catch {
          // user refused to sign the unlock message — fall through to wallet path
        }
      }

      if (sessionKp) {
        // Delegate signs both the SPL transfer authority AND the record_spend_as_delegate.
        // The transfer's authority is the OWNER, not the delegate — so delegate can't
        // actually move owner's USDC. We need the owner's wallet to sign for the SPL
        // transfer. Workaround: delegate-signed flow still needs owner signature for
        // the actual USDC movement. So the "no-popup" claim only holds if we move
        // USDC from a separate session-funded ATA. For v0, we accept that the SPL
        // transfer requires owner; only record_spend_as_delegate runs delegate-only.
        // This means the session-key path at v0 is record-only; full no-popup
        // requires either a session-funded ATA OR a wrapping program that can act
        // on the owner's USDC under the spending policy contract.
        //
        // Punting the no-popup-for-USDC-move work to v1; for v0 the session-key
        // path is shown as a code path + on-chain primitive ready for the v1 wrapping.
        sessionKp = null; // disable session path for SPL until v1 wrapping ships
      }
    }

    // ----------------------------------------------------------------
    // Owner-signed fallback (existing behavior)
    // ----------------------------------------------------------------
    const tx = new Transaction();

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        toAta,
        MERCHANT_ADDRESS,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    tx.add(
      createTransferInstruction(fromAta, toAta, owner, amount, [], TOKEN_PROGRAM_ID)
    );

    tx.add(ixRecordSpend(owner, amount));

    tx.feePayer = owner;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    // Attribute referral if user landed via /c/[handle]
    const refMatch = document.cookie.match(/(?:^|;\s*)shopier_ref=([^;]+)/);
    if (refMatch) {
      try {
        await fetch("/api/creators/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: decodeURIComponent(refMatch[1]),
            referredPubkey: owner.toBase58(),
            purchaseSignature: signature,
            purchaseAmountUsd: amountUsd,
            settlementAsset: symbol,
          }),
        });
      } catch {
        // Non-critical — purchase already settled
      }
    }

    return {
      signature,
      autoApproved,
      amountUsdc: amountUsd,
      symbol,
      signedByDelegate,
      explorerUrl: `https://solscan.io/tx/${signature}?cluster=devnet`,
    };
  }

  // unused parameter ref to keep TS happy when ixRecordSpendAsDelegate is imported but
  // not yet routed through (full session-flow lands when v1 wrapping program ships)
  void ixRecordSpendAsDelegate;

  return { purchase, connected: !!wallet.publicKey, publicKey: wallet.publicKey };
}

async function simulate(
  conn: ReturnType<typeof useConnection>["connection"],
  owner: PublicKey,
  amount: bigint
): Promise<{ autoApproved: boolean } | { error: string }> {
  const tx = new Transaction().add(ixCheckSpend(owner, amount));
  tx.feePayer = owner;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    const failed = logs.find(
      (l) => l.includes("Error") || l.includes("AnchorError")
    );
    return { error: failed || JSON.stringify(sim.value.err) };
  }
  const ret = sim.value.returnData?.data;
  if (!ret) return { autoApproved: false };
  const buf = Buffer.from(ret[0], "base64");
  return { autoApproved: buf[0] === 1 };
}

// Re-export for convenience
export { policyPda, dailyPda };
