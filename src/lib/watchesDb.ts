import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * Watch policies — off-chain in v0, on-chain `WatchPolicy` PDA in v1.
 *
 * Schema is intentionally identical to the future PDA so migration is a
 * straight read-and-write. When the spending_policy program redeploy lands
 * with `set_watch_policy`/`clear_watch_policy` instructions, a one-time
 * migration script reads from this table and submits them per-user.
 *
 * Each watch ties (wallet, celeb_slug) → filters + auto-buy mode. A user
 * can have multiple watches — one per (celeb, mode) pair.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "watches.db");

export type WatchMode = "notify" | "auto-buy-under-cap" | "auto-buy-full";

export interface Watch {
  id: string;
  walletPubkey: string;
  celebSlug: string;
  celebName: string;
  /** "mens" | "womens" | "both" | "androgynous" — null means use twin default */
  sectionFilter: string | null;
  /** "masculine" | "neutral" | "feminine" — null means use twin default */
  registerFilter: string | null;
  /** Hard cap per look. The on-chain spending policy enforces global $/day; this is a per-watch cap on top. */
  maxPerLookUsd: number;
  /** notify | auto-buy-under-cap | auto-buy-full. auto-buy modes require an active session-key delegate. */
  mode: WatchMode;
  /** Optional: which event slug this watch applies to. Null = all events. */
  eventScope: string | null;
  /** Unix ms when the watch was created (signs which deletion is newer in conflict resolution). */
  createdAt: number;
  /** Unix ms — null while active, set when revoked. */
  revokedAt: number | null;
}

let db: Database.Database | null = null;
function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS watches (
      id TEXT PRIMARY KEY,
      wallet_pubkey TEXT NOT NULL,
      celeb_slug TEXT NOT NULL,
      celeb_name TEXT NOT NULL,
      section_filter TEXT,
      register_filter TEXT,
      max_per_look_usd INTEGER NOT NULL,
      mode TEXT NOT NULL,
      event_scope TEXT,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_watches_wallet ON watches(wallet_pubkey);
    CREATE INDEX IF NOT EXISTS idx_watches_celeb ON watches(celeb_slug);
    CREATE INDEX IF NOT EXISTS idx_watches_active ON watches(wallet_pubkey, revoked_at);

    CREATE TABLE IF NOT EXISTS watch_inbox (
      id TEXT PRIMARY KEY,
      watch_id TEXT NOT NULL,
      wallet_pubkey TEXT NOT NULL,
      look_id TEXT NOT NULL,
      celeb_slug TEXT NOT NULL,
      total_budget_usd INTEGER NOT NULL,
      status TEXT NOT NULL,         -- pending | cancelled | bought | expired
      auto_buy_at INTEGER,           -- unix ms when the 30s window expires
      bought_tx_sig TEXT,            -- on-chain signature once bought
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_wallet ON watch_inbox(wallet_pubkey, status);
    CREATE INDEX IF NOT EXISTS idx_inbox_status ON watch_inbox(status, auto_buy_at);
  `);
  return db;
}

function row2watch(r: Record<string, unknown>): Watch {
  return {
    id: r.id as string,
    walletPubkey: r.wallet_pubkey as string,
    celebSlug: r.celeb_slug as string,
    celebName: r.celeb_name as string,
    sectionFilter: (r.section_filter as string | null) ?? null,
    registerFilter: (r.register_filter as string | null) ?? null,
    maxPerLookUsd: r.max_per_look_usd as number,
    mode: r.mode as WatchMode,
    eventScope: (r.event_scope as string | null) ?? null,
    createdAt: r.created_at as number,
    revokedAt: (r.revoked_at as number | null) ?? null,
  };
}

export function listWatchesForWallet(walletPubkey: string): Watch[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM watches WHERE wallet_pubkey = ? AND revoked_at IS NULL ORDER BY created_at DESC"
    )
    .all(walletPubkey) as Record<string, unknown>[];
  return rows.map(row2watch);
}

export function getWatch(id: string): Watch | null {
  const r = getDb()
    .prepare("SELECT * FROM watches WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return r ? row2watch(r) : null;
}

export function createWatch(input: {
  id: string;
  walletPubkey: string;
  celebSlug: string;
  celebName: string;
  sectionFilter: string | null;
  registerFilter: string | null;
  maxPerLookUsd: number;
  mode: WatchMode;
  eventScope: string | null;
}): Watch {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO watches
        (id, wallet_pubkey, celeb_slug, celeb_name, section_filter, register_filter,
         max_per_look_usd, mode, event_scope, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(
      input.id,
      input.walletPubkey,
      input.celebSlug,
      input.celebName,
      input.sectionFilter,
      input.registerFilter,
      input.maxPerLookUsd,
      input.mode,
      input.eventScope,
      now
    );
  return {
    ...input,
    createdAt: now,
    revokedAt: null,
  };
}

export function revokeWatch(id: string): void {
  getDb()
    .prepare("UPDATE watches SET revoked_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

/** Count distinct wallets currently watching ANY celeb in the given event. */
export function countWatchersForEvent(eventSlug: string): number {
  const r = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT wallet_pubkey) AS n FROM watches
       WHERE (event_scope = ? OR event_scope IS NULL)
         AND revoked_at IS NULL`
    )
    .get(eventSlug) as { n: number } | undefined;
  return r?.n ?? 0;
}

/** Count auto-buys (status='bought') created since a given unix-ms timestamp. */
export function countBoughtSince(sinceMs: number): number {
  const r = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM watch_inbox
       WHERE status = 'bought' AND created_at > ?`
    )
    .get(sinceMs) as { n: number } | undefined;
  return r?.n ?? 0;
}

/** Recent inbox entries that have completed (bought or cancelled), site-wide. */
export function recentSiteInboxActivity(limit = 20): InboxEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM watch_inbox
       WHERE status IN ('bought', 'cancelled')
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(row2inbox);
}

/** Recent watches created site-wide (all wallets). */
export function recentSiteWatches(limit = 20): Watch[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM watches
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(row2watch);
}

/** All wallets currently watching this celeb — drives the matcher. */
export function walletsWatchingCeleb(celebSlug: string): Watch[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM watches WHERE celeb_slug = ? AND revoked_at IS NULL"
    )
    .all(celebSlug) as Record<string, unknown>[];
  return rows.map(row2watch);
}

// =============================================================================
// Watch inbox — pending matches, auto-buy countdown, cancel support
// =============================================================================

export interface InboxEntry {
  id: string;
  watchId: string;
  walletPubkey: string;
  lookId: string;
  celebSlug: string;
  totalBudgetUsd: number;
  status: "pending" | "cancelled" | "bought" | "expired";
  /** Unix ms when the auto-buy fires; null if mode = notify-only. */
  autoBuyAt: number | null;
  boughtTxSig: string | null;
  createdAt: number;
}

function row2inbox(r: Record<string, unknown>): InboxEntry {
  return {
    id: r.id as string,
    watchId: r.watch_id as string,
    walletPubkey: r.wallet_pubkey as string,
    lookId: r.look_id as string,
    celebSlug: r.celeb_slug as string,
    totalBudgetUsd: r.total_budget_usd as number,
    status: r.status as InboxEntry["status"],
    autoBuyAt: (r.auto_buy_at as number | null) ?? null,
    boughtTxSig: (r.bought_tx_sig as string | null) ?? null,
    createdAt: r.created_at as number,
  };
}

export function createInboxEntry(input: {
  id: string;
  watchId: string;
  walletPubkey: string;
  lookId: string;
  celebSlug: string;
  totalBudgetUsd: number;
  /** When auto-buy fires (now + 30s typically). null for notify-only mode. */
  autoBuyAt: number | null;
}): InboxEntry {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO watch_inbox
        (id, watch_id, wallet_pubkey, look_id, celeb_slug, total_budget_usd,
         status, auto_buy_at, bought_tx_sig, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?)`
    )
    .run(
      input.id,
      input.watchId,
      input.walletPubkey,
      input.lookId,
      input.celebSlug,
      input.totalBudgetUsd,
      input.autoBuyAt,
      now
    );
  return {
    ...input,
    status: "pending",
    boughtTxSig: null,
    createdAt: now,
  };
}

export function listInboxForWallet(walletPubkey: string): InboxEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM watch_inbox WHERE wallet_pubkey = ? ORDER BY created_at DESC LIMIT 50"
    )
    .all(walletPubkey) as Record<string, unknown>[];
  return rows.map(row2inbox);
}

export function setInboxStatus(
  id: string,
  status: InboxEntry["status"],
  txSig?: string | null
): void {
  getDb()
    .prepare(
      "UPDATE watch_inbox SET status = ?, bought_tx_sig = COALESCE(?, bought_tx_sig) WHERE id = ?"
    )
    .run(status, txSig ?? null, id);
}

export function getInboxEntry(id: string): InboxEntry | null {
  const r = getDb()
    .prepare("SELECT * FROM watch_inbox WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return r ? row2inbox(r) : null;
}
