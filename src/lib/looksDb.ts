import Database from "better-sqlite3";
import { customAlphabet } from "nanoid";
import path from "path";
import fs from "fs";
import { dataDir } from "@/lib/dataDir";

// SQLite for v0 — zero infra, single file, easy to inspect. Swap to Postgres
// when there's a reason. The .data/ directory is gitignored.

const DATA_DIR = dataDir();
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "looks.db");

const slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const newSlug = customAlphabet(slugAlphabet, 10);

export interface LookItem {
  name: string;
  category: string;
  color: string;
  style: string;
  fitToYou?: string;
  retailer?: string;
  url?: string;
  price?: number;
  imageUrl?: string;
  tier?: string;
}

export interface Look {
  slug: string;
  ownerPubkey: string | null;
  title: string;
  styleNotes: string;
  occasion: string;
  aesthetic: string;
  items: LookItem[];
  sourceImageBase64: string | null;
  createdAt: number;
  views: number;
  creatorHandle: string | null;
  signedByPubkey: string | null;
  signatureB58: string | null;
  contentHash: string | null;
}

let db: Database.Database | null = null;
function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS looks (
      slug TEXT PRIMARY KEY,
      owner_pubkey TEXT,
      title TEXT NOT NULL,
      style_notes TEXT NOT NULL DEFAULT '',
      occasion TEXT NOT NULL DEFAULT '',
      aesthetic TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      source_image_base64 TEXT,
      created_at INTEGER NOT NULL,
      views INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_looks_owner ON looks(owner_pubkey);
    CREATE INDEX IF NOT EXISTS idx_looks_created ON looks(created_at DESC);
  `);
  // Lazy-add columns — supports DBs created before signed-look fields existed.
  const cols = db.prepare("PRAGMA table_info(looks)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("creator_handle")) {
    db.exec("ALTER TABLE looks ADD COLUMN creator_handle TEXT");
  }
  if (!colNames.has("signed_by_pubkey")) {
    db.exec("ALTER TABLE looks ADD COLUMN signed_by_pubkey TEXT");
  }
  if (!colNames.has("signature_b58")) {
    db.exec("ALTER TABLE looks ADD COLUMN signature_b58 TEXT");
  }
  if (!colNames.has("content_hash")) {
    db.exec("ALTER TABLE looks ADD COLUMN content_hash TEXT");
  }
  return db;
}

interface LookRow {
  slug: string;
  owner_pubkey: string | null;
  title: string;
  style_notes: string;
  occasion: string;
  aesthetic: string;
  items_json: string;
  source_image_base64: string | null;
  created_at: number;
  views: number;
  creator_handle: string | null;
  signed_by_pubkey: string | null;
  signature_b58: string | null;
  content_hash: string | null;
}

function rowToLook(r: LookRow): Look {
  return {
    slug: r.slug,
    ownerPubkey: r.owner_pubkey,
    title: r.title,
    styleNotes: r.style_notes,
    occasion: r.occasion,
    aesthetic: r.aesthetic,
    items: JSON.parse(r.items_json) as LookItem[],
    sourceImageBase64: r.source_image_base64,
    createdAt: r.created_at,
    views: r.views,
    creatorHandle: r.creator_handle ?? null,
    signedByPubkey: r.signed_by_pubkey ?? null,
    signatureB58: r.signature_b58 ?? null,
    contentHash: r.content_hash ?? null,
  };
}

export interface CreateLookInput {
  ownerPubkey?: string | null;
  title: string;
  styleNotes?: string;
  occasion?: string;
  aesthetic?: string;
  items: LookItem[];
  sourceImageBase64?: string | null;
  // Optional curator attestation
  creatorHandle?: string | null;
  signedByPubkey?: string | null;
  signatureB58?: string | null;
  contentHash?: string | null;
}

export function createLook(input: CreateLookInput): Look {
  const slug = newSlug();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO looks
       (slug, owner_pubkey, title, style_notes, occasion, aesthetic, items_json, source_image_base64, created_at, views,
        creator_handle, signed_by_pubkey, signature_b58, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
    .run(
      slug,
      input.ownerPubkey ?? null,
      input.title.slice(0, 200),
      (input.styleNotes ?? "").slice(0, 1000),
      (input.occasion ?? "").slice(0, 200),
      (input.aesthetic ?? "").slice(0, 100),
      JSON.stringify(input.items),
      input.sourceImageBase64 ?? null,
      now,
      input.creatorHandle ?? null,
      input.signedByPubkey ?? null,
      input.signatureB58 ?? null,
      input.contentHash ?? null
    );
  return getLook(slug)!;
}

export function getLook(slug: string): Look | null {
  const row = getDb().prepare("SELECT * FROM looks WHERE slug = ?").get(slug) as
    | LookRow
    | undefined;
  return row ? rowToLook(row) : null;
}

export function bumpViews(slug: string): void {
  getDb().prepare("UPDATE looks SET views = views + 1 WHERE slug = ?").run(slug);
}

export function listRecentLooks(limit = 24): Look[] {
  const rows = getDb()
    .prepare("SELECT * FROM looks ORDER BY created_at DESC LIMIT ?")
    .all(limit) as LookRow[];
  return rows.map(rowToLook);
}

export function listLooksByOwner(ownerPubkey: string, limit = 50): Look[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM looks WHERE owner_pubkey = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(ownerPubkey, limit) as LookRow[];
  return rows.map(rowToLook);
}
