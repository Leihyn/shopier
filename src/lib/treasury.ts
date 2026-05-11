import { Keypair } from "@solana/web3.js";

let cachedTreasury: Keypair | null = null;

/**
 * Loads the treasury signer from TREASURY_SECRET_KEY env var. Cached after first load.
 * The env var must be a JSON array of bytes (the format `solana-keygen new` produces).
 *
 * Server-only — DO NOT export to client bundle.
 */
export function getTreasuryKeypair(): Keypair {
  if (cachedTreasury) return cachedTreasury;
  const raw = process.env.TREASURY_SECRET_KEY;
  if (!raw) {
    throw new Error("TREASURY_SECRET_KEY not set");
  }
  let bytes: number[];
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error("TREASURY_SECRET_KEY must be a JSON byte array");
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error("TREASURY_SECRET_KEY must be a 64-byte array");
  }
  cachedTreasury = Keypair.fromSecretKey(Uint8Array.from(bytes));
  return cachedTreasury;
}
