import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "looks.db");

let db: Database.Database | null = null;
function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS activations_redeemed (
      nonce TEXT PRIMARY KEY,
      user_pubkey TEXT NOT NULL,
      activation_type TEXT NOT NULL,
      signature TEXT NOT NULL,
      redeemed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activations_user ON activations_redeemed(user_pubkey);

    CREATE TABLE IF NOT EXISTS creators (
      handle TEXT PRIMARY KEY,
      pubkey TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      cut_bps INTEGER NOT NULL DEFAULT 500,
      payout_address TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creator_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_handle TEXT NOT NULL,
      referred_pubkey TEXT,
      referred_at INTEGER NOT NULL,
      purchase_signature TEXT,
      purchase_amount_usd REAL,
      commission_amount_usd REAL,
      FOREIGN KEY (creator_handle) REFERENCES creators(handle)
    );
    CREATE INDEX IF NOT EXISTS idx_referrals_creator ON creator_referrals(creator_handle);
    CREATE INDEX IF NOT EXISTS idx_referrals_pubkey ON creator_referrals(referred_pubkey);
  `);
  // Lazy-add SNS column for DBs created before SNS integration
  const cols = db
    .prepare("PRAGMA table_info(creators)")
    .all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("dotsol_name")) {
    db.exec("ALTER TABLE creators ADD COLUMN dotsol_name TEXT");
  }
  return db;
}

export interface Creator {
  handle: string;
  pubkey: string;
  bio: string;
  cutBps: number; // basis points, e.g. 500 = 5%
  payoutAddress: string;
  createdAt: number;
  /** Verified .sol name (owner-resolved, no leading @ or trailing .sol). Null if unset. */
  dotsolName: string | null;
}

interface CreatorRow {
  handle: string;
  pubkey: string;
  bio: string;
  cut_bps: number;
  payout_address: string;
  created_at: number;
  dotsol_name: string | null;
}

function rowToCreator(r: CreatorRow): Creator {
  return {
    handle: r.handle,
    pubkey: r.pubkey,
    bio: r.bio,
    cutBps: r.cut_bps,
    payoutAddress: r.payout_address,
    createdAt: r.created_at,
    dotsolName: r.dotsol_name ?? null,
  };
}

export function createCreator(input: {
  handle: string;
  pubkey: string;
  bio: string;
  cutBps: number;
  payoutAddress: string;
  dotsolName?: string | null;
}): Creator {
  const handle = input.handle.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (handle.length === 0 || handle.length > 32) {
    throw new Error("handle must be 1-32 chars [a-z0-9_-]");
  }
  if (input.cutBps < 0 || input.cutBps > 5000) {
    throw new Error("cut_bps must be 0..5000 (max 50%)");
  }
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO creators (handle, pubkey, bio, cut_bps, payout_address, created_at, dotsol_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      handle,
      input.pubkey,
      input.bio.slice(0, 500),
      input.cutBps,
      input.payoutAddress,
      now,
      input.dotsolName?.toLowerCase() || null
    );
  return getCreator(handle)!;
}

/**
 * Update the .sol name on an existing creator. Used after they verify
 * ownership of a .sol they didn't claim at registration time.
 */
export function setCreatorDotsol(
  handle: string,
  dotsolName: string | null
): void {
  getDb()
    .prepare("UPDATE creators SET dotsol_name = ? WHERE handle = ?")
    .run(dotsolName?.toLowerCase() || null, handle.toLowerCase());
}

export function getCreator(handle: string): Creator | null {
  const row = getDb()
    .prepare("SELECT * FROM creators WHERE handle = ?")
    .get(handle.toLowerCase()) as CreatorRow | undefined;
  return row ? rowToCreator(row) : null;
}

export function listCreators(limit = 100): Creator[] {
  const rows = getDb()
    .prepare("SELECT * FROM creators ORDER BY created_at DESC LIMIT ?")
    .all(limit) as CreatorRow[];
  return rows.map(rowToCreator);
}

export function recordReferral(input: {
  creatorHandle: string;
  referredPubkey: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO creator_referrals (creator_handle, referred_pubkey, referred_at)
       VALUES (?, ?, ?)`
    )
    .run(input.creatorHandle.toLowerCase(), input.referredPubkey, Date.now());
}

export function attributeReferralPurchase(input: {
  creatorHandle: string;
  referredPubkey: string;
  purchaseSignature: string;
  purchaseAmountUsd: number;
  commissionAmountUsd: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO creator_referrals (creator_handle, referred_pubkey, referred_at, purchase_signature, purchase_amount_usd, commission_amount_usd)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.creatorHandle.toLowerCase(),
      input.referredPubkey,
      Date.now(),
      input.purchaseSignature,
      input.purchaseAmountUsd,
      input.commissionAmountUsd
    );
}

export interface CreatorStats {
  handle: string;
  totalReferrals: number;
  uniqueReferred: number;
  purchaseCount: number;
  grossVolumeUsd: number;
  totalCommissionUsd: number;
  recentReferrals: Array<{
    referredPubkey: string | null;
    referredAt: number;
    purchaseSignature: string | null;
    purchaseAmountUsd: number | null;
    commissionAmountUsd: number | null;
  }>;
}

export function getCreatorStats(handle: string): CreatorStats {
  const h = handle.toLowerCase();
  const totals = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(DISTINCT referred_pubkey) AS unique_referred,
         COUNT(purchase_signature) AS purchase_count,
         COALESCE(SUM(purchase_amount_usd), 0) AS gross,
         COALESCE(SUM(commission_amount_usd), 0) AS commission
       FROM creator_referrals WHERE creator_handle = ?`
    )
    .get(h) as {
      total: number;
      unique_referred: number;
      purchase_count: number;
      gross: number;
      commission: number;
    };
  const rows = getDb()
    .prepare(
      `SELECT referred_pubkey, referred_at, purchase_signature, purchase_amount_usd, commission_amount_usd
       FROM creator_referrals WHERE creator_handle = ? ORDER BY referred_at DESC LIMIT 25`
    )
    .all(h) as Array<{
      referred_pubkey: string | null;
      referred_at: number;
      purchase_signature: string | null;
      purchase_amount_usd: number | null;
      commission_amount_usd: number | null;
    }>;
  return {
    handle: h,
    totalReferrals: totals.total,
    uniqueReferred: totals.unique_referred,
    purchaseCount: totals.purchase_count,
    grossVolumeUsd: totals.gross,
    totalCommissionUsd: totals.commission,
    recentReferrals: rows.map((r) => ({
      referredPubkey: r.referred_pubkey,
      referredAt: r.referred_at,
      purchaseSignature: r.purchase_signature,
      purchaseAmountUsd: r.purchase_amount_usd,
      commissionAmountUsd: r.commission_amount_usd,
    })),
  };
}
