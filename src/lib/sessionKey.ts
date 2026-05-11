"use client";

import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

/**
 * Session-key (delegate) management on the client.
 *
 * The session keypair is generated locally, encrypted at rest with a
 * 32-byte key derived from a deterministic wallet signature, and persisted
 * to localStorage. To unlock, the user signs a known message; the resulting
 * signature is hashed to a key that decrypts the session secret into memory.
 *
 * Per device. Per-tab cache after unlock. 24-hour delegate expiry by default.
 *
 * Threat model: an attacker with browser access can steal the encrypted
 * session blob, but cannot decrypt without forcing the user's wallet to sign.
 * If they capture the wallet signature too, they can spend up to the
 * delegate's daily bound until expiry. Bounded by physics + the on-chain
 * record_spend_as_delegate validation.
 */

const STORAGE_KEY = "shopier_session_v1";
const SESSION_KEY_DOMAIN = "shopier-session-key:v1";

interface StoredSession {
  encryptedSecret: string; // base64
  nonce: string;           // base64 (24 bytes)
  delegatePubkey: string;  // base58 — same data is on-chain too
  expiresAt: number;       // unix seconds
  ownerPubkey: string;     // base58 — guard against wrong-wallet decrypt
}

/** Generate a new ephemeral keypair to use as the session key. */
export function newSessionKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Derive the encryption key from a wallet signature over a fixed message.
 * The same wallet always produces the same signature → the same key.
 */
export async function deriveSessionEncryptionKey(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<Uint8Array> {
  const message = naclUtil.decodeUTF8(SESSION_KEY_DOMAIN);
  const signature = await signMessage(message);
  const sigCopy = new Uint8Array(signature.length);
  sigCopy.set(signature);
  const digest = await crypto.subtle.digest("SHA-256", sigCopy.buffer);
  return new Uint8Array(digest);
}

/** Encrypt a session keypair's secret bytes with the wallet-derived key. */
export function encryptSessionSecret(
  sessionKeypair: Keypair,
  encryptionKey: Uint8Array
): { encryptedSecret: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const encryptedSecret = nacl.secretbox(
    sessionKeypair.secretKey,
    nonce,
    encryptionKey
  );
  return { encryptedSecret, nonce };
}

/** Decrypt the session secret. Returns null on failure. */
export function decryptSessionSecret(
  encryptedSecret: Uint8Array,
  nonce: Uint8Array,
  encryptionKey: Uint8Array
): Uint8Array | null {
  return nacl.secretbox.open(encryptedSecret, nonce, encryptionKey);
}

export interface PersistedSession {
  ownerPubkey: string;
  delegatePubkey: string;
  expiresAt: number;
}

/** Persist the encrypted session to localStorage. */
export function storeSession(
  ownerPubkey: string,
  sessionKeypair: Keypair,
  encryptedSecret: Uint8Array,
  nonce: Uint8Array,
  expiresAtUnix: number
): void {
  const stored: StoredSession = {
    encryptedSecret: naclUtil.encodeBase64(encryptedSecret),
    nonce: naclUtil.encodeBase64(nonce),
    delegatePubkey: sessionKeypair.publicKey.toBase58(),
    expiresAt: expiresAtUnix,
    ownerPubkey,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/** Read the persisted session metadata (without decrypting). */
export function readPersistedSession(
  ownerPubkey: string
): PersistedSession | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredSession;
    if (stored.ownerPubkey !== ownerPubkey) return null; // wrong wallet
    if (stored.expiresAt < Math.floor(Date.now() / 1000)) return null; // expired
    return {
      ownerPubkey: stored.ownerPubkey,
      delegatePubkey: stored.delegatePubkey,
      expiresAt: stored.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Unlock the session — derive the key (one wallet signature), decrypt,
 * return the live Keypair. Caller should hold this in memory; we don't cache.
 */
export async function unlockSession(
  ownerPubkey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<Keypair | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const stored = JSON.parse(raw) as StoredSession;
  if (stored.ownerPubkey !== ownerPubkey) return null;
  if (stored.expiresAt < Math.floor(Date.now() / 1000)) return null;

  const encryptionKey = await deriveSessionEncryptionKey(signMessage);
  const encrypted = naclUtil.decodeBase64(stored.encryptedSecret);
  const nonce = naclUtil.decodeBase64(stored.nonce);
  const secret = decryptSessionSecret(encrypted, nonce, encryptionKey);
  if (!secret) return null;
  return Keypair.fromSecretKey(secret);
}

/** Wipe the persisted session. */
export function clearSession(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Default delegate expiry: 24 hours from now. */
export function defaultExpiresAtUnix(): number {
  return Math.floor(Date.now() / 1000) + 24 * 60 * 60;
}
