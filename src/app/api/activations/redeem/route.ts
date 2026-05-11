import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import bs58 from "bs58";
import {
  DEVNET_RPC,
  USDC_MINT_DEVNET,
  ixInitPendingTwin,
  toStableUnits,
} from "@/lib/solana";
import { getTreasuryKeypair } from "@/lib/treasury";
import {
  isNonceRedeemed,
  hasUserRedeemedType,
  recordRedemption,
} from "@/lib/activationsDb";

/**
 * theMiracle activation receipt.
 *
 * Verification mode is controlled by env:
 *   THEMIRACLE_PUBLIC_KEY        — base58 ed25519 verification key (32 bytes)
 *   THEMIRACLE_DEV_MODE          — when "1", accepts well-formed receipts
 *                                  without signature verification (devnet only).
 *
 * Production: get the public key from theMiracle's brand console / dev contact,
 * paste it into THEMIRACLE_PUBLIC_KEY, and remove THEMIRACLE_DEV_MODE.
 */
interface ActivationReceipt {
  nonce: string;
  activationType: string;
  budgetUsd: number;
  userPubkey: string;       // bound: which user this receipt is for
  expiresAt: number;        // unix seconds; the redemption rejects if past
  signature?: string;       // base58 ed25519 signature over canonical(receipt)
}

interface RedeemRequest {
  userPubkey: string;
  receipt: ActivationReceipt;
}

const SHOPIER_ONBOARDING = "shopier-onboarding";
const MAX_BUDGET_USD = 100;

function canonicalReceiptBytes(r: ActivationReceipt): Uint8Array {
  // Deterministic JSON ordering — fields signed by theMiracle MUST be canonicalized
  // identically on both sides. We sort keys alphabetically and exclude `signature`.
  const canonical = JSON.stringify({
    activationType: r.activationType,
    budgetUsd: r.budgetUsd,
    expiresAt: r.expiresAt,
    nonce: r.nonce,
    userPubkey: r.userPubkey,
  });
  return naclUtil.decodeUTF8(canonical);
}

function verifyReceipt(receipt: ActivationReceipt, requestUser: string): { ok: true } | { ok: false; reason: string } {
  // Schema checks (always run)
  if (!receipt.nonce || receipt.nonce.length < 8) {
    return { ok: false, reason: "Invalid nonce" };
  }
  if (!receipt.activationType) {
    return { ok: false, reason: "Missing activationType" };
  }
  if (typeof receipt.budgetUsd !== "number" || receipt.budgetUsd < 0) {
    return { ok: false, reason: "Invalid budgetUsd" };
  }
  if (receipt.budgetUsd > MAX_BUDGET_USD) {
    return {
      ok: false,
      reason: `Budget exceeds Shopier server cap of $${MAX_BUDGET_USD}`,
    };
  }
  if (receipt.userPubkey !== requestUser) {
    return {
      ok: false,
      reason: "Receipt userPubkey does not match request signer",
    };
  }
  const now = Math.floor(Date.now() / 1000);
  if (receipt.expiresAt && receipt.expiresAt < now) {
    return { ok: false, reason: "Receipt expired" };
  }

  // Signature path
  const pubKeyB58 = process.env.THEMIRACLE_PUBLIC_KEY;
  const devMode = process.env.THEMIRACLE_DEV_MODE === "1";

  if (!pubKeyB58 && !devMode) {
    return {
      ok: false,
      reason:
        "theMiracle verification key not configured (set THEMIRACLE_PUBLIC_KEY or THEMIRACLE_DEV_MODE=1)",
    };
  }
  if (!pubKeyB58 && devMode) {
    // Dev mode: schema-only checks, no signature.
    return { ok: true };
  }

  if (!receipt.signature) {
    return { ok: false, reason: "Receipt signature required" };
  }
  let pubKey: Uint8Array;
  let sig: Uint8Array;
  try {
    pubKey = bs58.decode(pubKeyB58!);
    sig = bs58.decode(receipt.signature);
  } catch {
    return { ok: false, reason: "Invalid base58 in pubKey or signature" };
  }
  if (pubKey.length !== 32) {
    return { ok: false, reason: "theMiracle public key must be 32 bytes" };
  }
  if (sig.length !== 64) {
    return { ok: false, reason: "Signature must be 64 bytes" };
  }
  const message = canonicalReceiptBytes(receipt);
  const valid = nacl.sign.detached.verify(message, sig, pubKey);
  if (!valid) {
    return { ok: false, reason: "Signature verification failed" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  let body: RedeemRequest;
  try {
    body = (await req.json()) as RedeemRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userPubkey, receipt } = body;
  if (!userPubkey || !receipt) {
    return NextResponse.json(
      { error: "userPubkey and receipt are required" },
      { status: 400 }
    );
  }

  let user: PublicKey;
  try {
    user = new PublicKey(userPubkey);
  } catch {
    return NextResponse.json(
      { error: "Invalid userPubkey" },
      { status: 400 }
    );
  }

  const verified = verifyReceipt(receipt, userPubkey);
  if (!verified.ok) {
    return NextResponse.json(
      { error: `Invalid activation receipt: ${verified.reason}` },
      { status: 400 }
    );
  }

  if (isNonceRedeemed(receipt.nonce)) {
    return NextResponse.json(
      { error: "This activation has already been redeemed" },
      { status: 409 }
    );
  }

  // Sybil resistance: one redemption per user per activation type.
  if (
    receipt.activationType === SHOPIER_ONBOARDING &&
    hasUserRedeemedType(userPubkey, SHOPIER_ONBOARDING)
  ) {
    return NextResponse.json(
      { error: "This wallet has already redeemed the Shopier onboarding activation" },
      { status: 409 }
    );
  }

  let treasury;
  try {
    treasury = getTreasuryKeypair();
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }

  const conn = new Connection(DEVNET_RPC, "confirmed");

  try {
    const tx = new Transaction();

    // 1. Idempotent USDC ATA for the user (treasury pays rent if missing)
    const userUsdcAta = getAssociatedTokenAddressSync(USDC_MINT_DEVNET, user);
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        treasury.publicKey,
        userUsdcAta,
        user,
        USDC_MINT_DEVNET,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // 2. Empty pending twin PDA (treasury signs)
    tx.add(ixInitPendingTwin(treasury.publicKey, user));

    // 3. USDC budget transfer from treasury to user
    if (receipt.budgetUsd > 0) {
      const treasuryAta = getAssociatedTokenAddressSync(
        USDC_MINT_DEVNET,
        treasury.publicKey
      );
      tx.add(
        createTransferInstruction(
          treasuryAta,
          userUsdcAta,
          treasury.publicKey,
          toStableUnits(receipt.budgetUsd),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    tx.feePayer = treasury.publicKey;
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(treasury);

    const signature = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    recordRedemption({
      nonce: receipt.nonce,
      userPubkey,
      activationType: receipt.activationType,
      signature,
    });

    return NextResponse.json({
      ok: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}?cluster=devnet`,
      message:
        "Activation redeemed. Sign in to Shopier to complete your twin and claim your stylist subscription.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Activation failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
