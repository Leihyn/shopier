"use client";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import type { TwinParams } from "@/lib/solana";

/**
 * Twin privacy is implemented client-side. The encryption key is derived from
 * a deterministic signed message. The user's wallet must sign once per session
 * to unlock; we don't persist the key.
 *
 * NOTE: This is symmetric encryption with a wallet-derived key. It is NOT
 * end-to-end private from the user's wallet provider — Phantom sees the
 * signature payload. For threat models that require provider-blindness,
 * upgrade to ed25519-derived X25519 keypairs and a separate per-twin nonce
 * exchange. For now, this is sufficient for "the chain only stores ciphertext."
 */

const TWIN_KEY_DOMAIN = "shopier-twin-key:v1";

export type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

/**
 * Derive a 32-byte symmetric key by asking the wallet to sign a fixed message.
 * The signature itself is the key material; we hash it with SHA-256 to fit
 * NaCl secretbox's 32-byte key size.
 */
export async function deriveTwinKey(signMessage: SignMessage): Promise<Uint8Array> {
  const message = naclUtil.decodeUTF8(TWIN_KEY_DOMAIN);
  const signature = await signMessage(message);
  // Hash the signature to a 32-byte key. Web Crypto SHA-256 is universally available.
  // Copy into a fresh ArrayBuffer because some environments hand back a SharedArrayBuffer-backed view.
  const sigCopy = new Uint8Array(signature.length);
  sigCopy.set(signature);
  const digest = await crypto.subtle.digest("SHA-256", sigCopy.buffer);
  return new Uint8Array(digest);
}

/**
 * Encrypt the structured twin params as a JSON blob.
 * Returns the ciphertext + a fresh 24-byte nonce.
 */
export function encryptTwin(
  params: TwinParams,
  key: Uint8Array
): { blob: Uint8Array; nonce: Uint8Array } {
  if (key.length !== 32) {
    throw new Error("Twin key must be 32 bytes");
  }
  const plaintext = naclUtil.decodeUTF8(JSON.stringify(params));
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const blob = nacl.secretbox(plaintext, nonce, key);
  return { blob, nonce };
}

/**
 * Decrypt a twin blob. Returns null if decryption fails (wrong key or tampering).
 */
export function decryptTwin(
  blob: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): TwinParams | null {
  if (key.length !== 32) {
    throw new Error("Twin key must be 32 bytes");
  }
  if (nonce.length !== 24) {
    return null;
  }
  const plaintext = nacl.secretbox.open(blob, nonce, key);
  if (!plaintext) return null;
  try {
    return JSON.parse(naclUtil.encodeUTF8(plaintext)) as TwinParams;
  } catch {
    return null;
  }
}
