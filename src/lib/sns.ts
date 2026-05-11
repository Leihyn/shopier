import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  resolve,
  reverseLookup,
  getDomainKeySync,
  Record as SnsRecordKey,
  getRecord,
} from "@bonfida/spl-name-service";

/**
 * Solana Name Service helpers.
 *
 * SNS routing is layered ON TOP OF Shopier's existing ascii-handle system,
 * not as a replacement. /c/[handle] still keys on the lowercase handle for
 * URL stability. SNS adds a verified .sol-identity column to creators —
 * when present, we render a "verified" badge and surface the .sol prominently.
 */

/** Strip a leading "@" and a trailing ".sol" if present. Returns the bare label. */
export function normalizeSnsLabel(input: string): string {
  return input
    .trim()
    .replace(/^@/, "")
    .replace(/\.sol$/i, "")
    .toLowerCase();
}

/** Resolve a .sol name to its owner Solana pubkey, or null if not registered. */
export async function resolveSnsName(
  conn: Connection,
  rawName: string
): Promise<PublicKey | null> {
  const label = normalizeSnsLabel(rawName);
  if (!label) return null;
  try {
    return await resolve(conn, label);
  } catch {
    // Domain doesn't exist or other error
    return null;
  }
}

/**
 * Verify that a .sol domain is owned by the given wallet.
 * Used at creator registration to confirm the user controls the .sol they claim.
 */
export async function verifySnsOwnership(
  conn: Connection,
  rawName: string,
  expectedOwner: PublicKey
): Promise<boolean> {
  const resolved = await resolveSnsName(conn, rawName);
  if (!resolved) return false;
  return resolved.equals(expectedOwner);
}

/** Reverse-lookup: derive the .sol name (if any) for a wallet. Returns null if unset. */
export async function reverseLookupWallet(
  conn: Connection,
  wallet: PublicKey
): Promise<string | null> {
  try {
    const name = await reverseLookup(conn, wallet);
    return name || null;
  } catch {
    return null;
  }
}

/** Format a creator's display label, preferring .sol when verified. */
export function formatCreatorLabel(
  asciiHandle: string,
  dotsolName: string | null
): string {
  if (dotsolName) return `${dotsolName}.sol`;
  return `@${asciiHandle}`;
}

/**
 * Resolve a `.sol` name → the owner's associated token account (ATA) for the
 * given mint. Used by settlement flows to send tokens to whoever owns the
 * name *right now*, not a hardcoded pubkey. Identity is portable.
 *
 * Returns null if the name doesn't resolve OR has no ATA for the mint
 * (caller should derive the ATA on-the-fly and create it as needed).
 */
export async function resolveSnsToAta(
  conn: Connection,
  rawName: string,
  mint: PublicKey
): Promise<{ owner: PublicKey; ata: PublicKey } | null> {
  const owner = await resolveSnsName(conn, rawName);
  if (!owner) return null;
  const ata = getAssociatedTokenAddressSync(mint, owner);
  return { owner, ata };
}

/**
 * Bonfida record types we surface on creator profiles. SNS records live
 * under the same name PDA — read-only here. Most names won't have all of
 * these set; missing fields return null without throwing.
 */
export interface SnsRecords {
  twitter: string | null;
  github: string | null;
  url: string | null;
  discord: string | null;
}

/** Pull the common social records from a `.sol` name. Empty object on miss. */
export async function fetchSnsRecords(
  conn: Connection,
  rawName: string
): Promise<SnsRecords> {
  const label = normalizeSnsLabel(rawName);
  if (!label) {
    return { twitter: null, github: null, url: null, discord: null };
  }

  // Each lookup wrapped — the SDK throws when the record is unset, which is
  // the common case. Treat throws as null to keep the call ergonomic.
  async function readOne(key: SnsRecordKey): Promise<string | null> {
    try {
      const r = await getRecord(conn, label, key);
      // getRecord returns a NameRegistryState; data is a Buffer with a
      // null-terminated UTF-8 string typically.
      const raw = r?.data?.toString("utf-8") ?? "";
      const cleaned = raw.replace(/\0+$/, "").trim();
      return cleaned || null;
    } catch {
      return null;
    }
  }

  const [twitter, github, url, discord] = await Promise.all([
    readOne(SnsRecordKey.Twitter),
    readOne(SnsRecordKey.Github),
    readOne(SnsRecordKey.Url),
    readOne(SnsRecordKey.Discord),
  ]);
  return { twitter, github, url, discord };
}

// Re-export for convenience
export { getDomainKeySync };
