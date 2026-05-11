import Database from "better-sqlite3";
import { customAlphabet } from "nanoid";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "looks.db");

const newClickId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

let db: Database.Database | null = null;
function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      click_id TEXT PRIMARY KEY,
      creator_handle TEXT,
      original_url TEXT NOT NULL,
      item_key TEXT,
      referrer TEXT,
      user_agent TEXT,
      clicked_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_creator ON affiliate_clicks(creator_handle);

    CREATE TABLE IF NOT EXISTS affiliate_sales (
      sale_id TEXT PRIMARY KEY,
      click_id TEXT,
      merchant TEXT NOT NULL,
      gross_amount_usd REAL NOT NULL,
      commission_amount_usd REAL NOT NULL,
      creator_handle TEXT,
      creator_payout_usd REAL NOT NULL,
      shopier_net_usd REAL NOT NULL,
      reported_at INTEGER NOT NULL,
      FOREIGN KEY (click_id) REFERENCES affiliate_clicks(click_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_creator ON affiliate_sales(creator_handle);
    CREATE INDEX IF NOT EXISTS idx_sales_click ON affiliate_sales(click_id);
  `);
  return db;
}

// 70/30 split: creator earns 70% of Shopier's net affiliate commission
// (after Skimlinks/network takes their cut, before Shopier keeps the rest).
export const CREATOR_AFFILIATE_SHARE_BPS = 7000;

export interface AffiliateClick {
  clickId: string;
  creatorHandle: string | null;
  originalUrl: string;
  itemKey: string | null;
  referrer: string | null;
  userAgent: string | null;
  clickedAt: number;
}

export function recordClick(input: {
  creatorHandle: string | null;
  originalUrl: string;
  itemKey?: string;
  referrer?: string | null;
  userAgent?: string | null;
}): string {
  const clickId = newClickId();
  getDb()
    .prepare(
      `INSERT INTO affiliate_clicks (click_id, creator_handle, original_url, item_key, referrer, user_agent, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      clickId,
      input.creatorHandle,
      input.originalUrl,
      input.itemKey ?? null,
      input.referrer ?? null,
      input.userAgent ?? null,
      Date.now()
    );
  return clickId;
}

export function getClick(clickId: string): AffiliateClick | null {
  const row = getDb()
    .prepare(
      `SELECT click_id AS clickId, creator_handle AS creatorHandle, original_url AS originalUrl,
              item_key AS itemKey, referrer, user_agent AS userAgent, clicked_at AS clickedAt
       FROM affiliate_clicks WHERE click_id = ?`
    )
    .get(clickId) as AffiliateClick | undefined;
  return row ?? null;
}

export interface SaleInput {
  saleId: string;
  clickId: string | null;
  merchant: string;
  grossAmountUsd: number;
  commissionAmountUsd: number;
}

export function recordSale(input: SaleInput): {
  creatorPayoutUsd: number;
  shopierNetUsd: number;
} {
  const click = input.clickId ? getClick(input.clickId) : null;
  const creatorHandle = click?.creatorHandle ?? null;
  let creatorPayoutUsd = 0;
  let shopierNetUsd = input.commissionAmountUsd;

  if (creatorHandle) {
    creatorPayoutUsd =
      (input.commissionAmountUsd * CREATOR_AFFILIATE_SHARE_BPS) / 10_000;
    shopierNetUsd = input.commissionAmountUsd - creatorPayoutUsd;
  }

  getDb()
    .prepare(
      `INSERT OR REPLACE INTO affiliate_sales
       (sale_id, click_id, merchant, gross_amount_usd, commission_amount_usd, creator_handle, creator_payout_usd, shopier_net_usd, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.saleId,
      input.clickId,
      input.merchant,
      input.grossAmountUsd,
      input.commissionAmountUsd,
      creatorHandle,
      creatorPayoutUsd,
      shopierNetUsd,
      Date.now()
    );

  return { creatorPayoutUsd, shopierNetUsd };
}

export interface CreatorAffiliateStats {
  clickCount: number;
  saleCount: number;
  grossVolumeUsd: number;
  totalEarnedUsd: number; // sum of creator_payout_usd
}

export function getCreatorAffiliateStats(
  creatorHandle: string
): CreatorAffiliateStats {
  const clicks = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM affiliate_clicks WHERE creator_handle = ?`
    )
    .get(creatorHandle.toLowerCase()) as { n: number };
  const sales = getDb()
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(gross_amount_usd), 0) AS gross,
              COALESCE(SUM(creator_payout_usd), 0) AS earned
       FROM affiliate_sales WHERE creator_handle = ?`
    )
    .get(creatorHandle.toLowerCase()) as {
    n: number;
    gross: number;
    earned: number;
  };
  return {
    clickCount: clicks.n,
    saleCount: sales.n,
    grossVolumeUsd: sales.gross,
    totalEarnedUsd: sales.earned,
  };
}
