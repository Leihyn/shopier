import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { dataDir } from "@/lib/dataDir";

const DATA_DIR = dataDir();
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
  `);
  return db;
}

export interface RedeemedActivation {
  nonce: string;
  userPubkey: string;
  activationType: string;
  signature: string;
  redeemedAt: number;
}

export function isNonceRedeemed(nonce: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM activations_redeemed WHERE nonce = ?")
    .get(nonce);
  return !!row;
}

export function hasUserRedeemedType(
  userPubkey: string,
  activationType: string
): boolean {
  const row = getDb()
    .prepare(
      "SELECT 1 FROM activations_redeemed WHERE user_pubkey = ? AND activation_type = ?"
    )
    .get(userPubkey, activationType);
  return !!row;
}

export function recordRedemption(input: {
  nonce: string;
  userPubkey: string;
  activationType: string;
  signature: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO activations_redeemed (nonce, user_pubkey, activation_type, signature, redeemed_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.nonce,
      input.userPubkey,
      input.activationType,
      input.signature,
      Date.now()
    );
}

export function listUserActivations(
  userPubkey: string
): RedeemedActivation[] {
  const rows = getDb()
    .prepare(
      `SELECT nonce, user_pubkey AS userPubkey, activation_type AS activationType, signature, redeemed_at AS redeemedAt
       FROM activations_redeemed WHERE user_pubkey = ? ORDER BY redeemed_at DESC`
    )
    .all(userPubkey) as RedeemedActivation[];
  return rows;
}
