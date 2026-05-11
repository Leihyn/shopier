import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import bs58 from "bs58";
import crypto from "crypto";

export const LOOK_SIGNATURE_DOMAIN = "shopier-look:v1";

/**
 * Canonical hash of look content for signing.
 * Stable across client + server: alphabetical key order, no whitespace.
 */
export function computeContentHash(payload: {
  title: string;
  styleNotes: string;
  occasion: string;
  aesthetic: string;
  items: Array<{
    name: string;
    category: string;
    color: string;
    style: string;
    tier?: string;
    retailer?: string;
    url?: string;
    price?: number;
  }>;
}): string {
  const normalizedItems = payload.items.map((it) => ({
    category: it.category,
    color: it.color,
    name: it.name,
    price: it.price ?? 0,
    retailer: it.retailer ?? "",
    style: it.style,
    tier: it.tier ?? "",
    url: it.url ?? "",
  }));
  const canonical = JSON.stringify({
    aesthetic: payload.aesthetic,
    items: normalizedItems,
    occasion: payload.occasion,
    styleNotes: payload.styleNotes,
    title: payload.title,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/** Bytes to be signed by the creator's wallet. */
export function buildSignablePayload(
  creatorHandle: string,
  contentHash: string
): Uint8Array {
  return naclUtil.decodeUTF8(
    `${LOOK_SIGNATURE_DOMAIN}:${creatorHandle.toLowerCase()}:${contentHash}`
  );
}

export function verifyLookSignature(input: {
  creatorHandle: string;
  contentHash: string;
  signedByPubkey: string; // base58 Solana pubkey
  signatureB58: string;   // base58 ed25519 signature
}): boolean {
  let pub: Uint8Array;
  let sig: Uint8Array;
  try {
    pub = bs58.decode(input.signedByPubkey);
    sig = bs58.decode(input.signatureB58);
  } catch {
    return false;
  }
  if (pub.length !== 32 || sig.length !== 64) return false;
  const message = buildSignablePayload(input.creatorHandle, input.contentHash);
  return nacl.sign.detached.verify(message, sig, pub);
}
