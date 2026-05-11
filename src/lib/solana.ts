import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
} from "@solana/spl-token";
import { createHash } from "crypto";

export const SPENDING_POLICY_PROGRAM_ID = new PublicKey(
  "2S7hJm57s4VBmBBpqe59XFFibKR9L2ykstMCm8xWreRt"
);
export const DIGITAL_TWIN_PROGRAM_ID = new PublicKey(
  "Dt3SWQmsAT1vDJyPRCPgMPXi2Rg47niXDVUzo6boFBCU"
);
export const STYLIST_MARKETPLACE_PROGRAM_ID = new PublicKey(
  "G5FE1NnanqQJGNCyqLnKqKonYFWVzyzoAeZ9rUtf8F5e"
);

// Circle's official devnet USDC. Mainnet is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// Test USDT mint we deployed on devnet (Tether mainnet is Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB).
// Same 6 decimals as USDC, so the spending policy can treat both as USD-units interchangeably.
export const USDT_MINT_DEVNET = new PublicKey(
  "9ucoaMxTT4LHLF8LU9FqPrqVDDLQ5yLigdFam2CDWRyE"
);

export const STABLE_DECIMALS = 6;
export const USDC_DECIMALS = 6; // legacy alias

export type StableSymbol = "USDC" | "USDT";

export const STABLE_MINTS: Record<StableSymbol, PublicKey> = {
  USDC: USDC_MINT_DEVNET,
  USDT: USDT_MINT_DEVNET,
};

export function mintForSymbol(symbol: StableSymbol): PublicKey {
  return STABLE_MINTS[symbol];
}

export function symbolForMint(mint: PublicKey): StableSymbol | null {
  const s = mint.toBase58();
  if (s === USDC_MINT_DEVNET.toBase58()) return "USDC";
  if (s === USDT_MINT_DEVNET.toBase58()) return "USDT";
  return null;
}

export const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

export function getConnection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

// Stablecoin base units (6 decimals — applies to both USDC and USDT on Solana).
// The spending policy stores limits in these units, mint-agnostic.
export function toStableUnits(usd: number): bigint {
  return BigInt(Math.round(usd * 10 ** STABLE_DECIMALS));
}

export function fromStableUnits(units: bigint | number): number {
  return Number(units) / 10 ** STABLE_DECIMALS;
}

// Legacy aliases — kept so existing call sites don't break in this refactor pass.
export const toUsdcUnits = toStableUnits;
export const fromUsdcUnits = fromStableUnits;

// Anchor discriminators: sha256("global:<fn>")[..8] for instructions, sha256("account:<Type>")[..8] for accounts.
function ixDisc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

/**
 * Browser-safe little-endian u64 writer.
 *
 * The bundled Buffer polyfill in browsers does NOT implement
 * `writeBigUInt64LE` / `writeBigInt64LE` — those are Node-native. Calling
 * them client-side throws "is not a function". We use this helper instead
 * for all instruction-data encoding so the same code path works in both
 * SSR (Node) and CSR (browser polyfill).
 */
function writeU64LE(buf: Buffer, value: bigint, offset: number): void {
  let v = BigInt.asUintN(64, value);
  for (let i = 0; i < 8; i++) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

/** Browser-safe little-endian i64 writer. */
function writeI64LE(buf: Buffer, value: bigint, offset: number): void {
  // Two's-complement: convert to unsigned representation first
  const v = value < 0n ? (1n << 64n) + value : value;
  writeU64LE(buf, v, offset);
}

/** Browser-safe little-endian u64 reader. */
function readU64LE(buf: Buffer | Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  return v;
}

/** Browser-safe little-endian i64 reader. */
function readI64LE(buf: Buffer | Uint8Array, offset: number): bigint {
  const u = readU64LE(buf, offset);
  // Sign-extend if the high bit is set
  return u >= 1n << 63n ? u - (1n << 64n) : u;
}

function accountDisc(typeName: string): Buffer {
  return createHash("sha256")
    .update(`account:${typeName}`)
    .digest()
    .subarray(0, 8);
}

// ============================================================
// PDAs
// ============================================================

export function policyPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.toBuffer()],
    SPENDING_POLICY_PROGRAM_ID
  );
}

export function dailyPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily"), owner.toBuffer()],
    SPENDING_POLICY_PROGRAM_ID
  );
}

export function delegationPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), owner.toBuffer()],
    SPENDING_POLICY_PROGRAM_ID
  );
}

export function twinPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("twin"), owner.toBuffer()],
    DIGITAL_TWIN_PROGRAM_ID
  );
}

// New PDA for encrypted twins. Coexists with the legacy plaintext "twin" PDA.
export function encryptedTwinPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("twin_v2"), owner.toBuffer()],
    DIGITAL_TWIN_PROGRAM_ID
  );
}

// WatchPolicy PDA — one per owner, holds celeb watchlist + auto-buy mode.
export function watchPolicyPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("watch"), owner.toBuffer()],
    DIGITAL_TWIN_PROGRAM_ID
  );
}

export function stylistProfilePda(stylist: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), stylist.toBuffer()],
    STYLIST_MARKETPLACE_PROGRAM_ID
  );
}

export function subscriptionPda(
  subscriber: PublicKey,
  stylist: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sub"), subscriber.toBuffer(), stylist.toBuffer()],
    STYLIST_MARKETPLACE_PROGRAM_ID
  );
}

// ============================================================
// spending_policy instructions
// ============================================================

export function ixInitializePolicy(
  owner: PublicKey,
  maxPerTx: bigint,
  maxDaily: bigint,
  autoApproveUnder: bigint,
  secondhandFirst: boolean
): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [daily] = dailyPda(owner);

  const args = Buffer.alloc(8 + 8 + 8 + 1);
  writeU64LE(args, maxPerTx, 0);
  writeU64LE(args, maxDaily, 8);
  writeU64LE(args, autoApproveUnder, 16);
  args.writeUInt8(secondhandFirst ? 1 : 0, 24);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: daily, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("initialize"), args]),
  });
}

export function ixCheckSpend(
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [daily] = dailyPda(owner);

  const args = Buffer.alloc(8);
  writeU64LE(args, amount, 0);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: daily, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("check_spend"), args]),
  });
}

export function ixRecordSpend(
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [daily] = dailyPda(owner);

  const args = Buffer.alloc(8);
  writeU64LE(args, amount, 0);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: daily, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([ixDisc("record_spend"), args]),
  });
}

/**
 * Owner-signed instruction registering a session key as a delegate that can
 * sign small purchases without owner re-signing. Bounds must be ≤ owner's bounds.
 */
export function ixSetDelegate(
  owner: PublicKey,
  delegate: PublicKey,
  maxPerTx: bigint,
  maxDaily: bigint,
  expiresAtUnix: bigint
): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [delegation] = delegationPda(owner);

  const args = Buffer.alloc(32 + 8 + 8 + 8);
  delegate.toBuffer().copy(args, 0);
  writeU64LE(args, maxPerTx, 32);
  writeU64LE(args, maxDaily, 40);
  writeI64LE(args, expiresAtUnix, 48);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: delegation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("set_delegate"), args]),
  });
}

/** Owner-signed instruction closing the delegation account (rent refunded). */
export function ixRevokeDelegate(owner: PublicKey): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [delegation] = delegationPda(owner);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: delegation, isSigner: false, isWritable: true },
    ],
    data: ixDisc("revoke_delegate"),
  });
}

/**
 * Delegate-signed instruction. The delegate signer must match the registered
 * delegation.delegate pubkey. The owner pubkey is passed for PDA derivation
 * but is NOT a signer here — that's the whole point of delegation.
 */
export function ixRecordSpendAsDelegate(
  owner: PublicKey,
  delegate: PublicKey,
  amount: bigint
): TransactionInstruction {
  const [policy] = policyPda(owner);
  const [daily] = dailyPda(owner);
  const [delegation] = delegationPda(owner);

  const args = Buffer.alloc(8);
  writeU64LE(args, amount, 0);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: delegate, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: daily, isSigner: false, isWritable: true },
      { pubkey: delegation, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([ixDisc("record_spend_as_delegate"), args]),
  });
}

export interface DelegationInfo {
  owner: PublicKey;
  delegate: PublicKey;
  maxPerTx: bigint;
  maxDaily: bigint;
  expiresAt: bigint;
  spentToday: bigint;
  lastResetUnix: bigint;
}

export async function fetchDelegation(
  conn: Connection,
  owner: PublicKey
): Promise<DelegationInfo | null> {
  const [delegation] = delegationPda(owner);
  const acc = await conn.getAccountInfo(delegation);
  if (!acc) return null;
  const d = acc.data;
  let off = 8; // discriminator
  const ownerKey = new PublicKey(d.subarray(off, off + 32));
  off += 32;
  const delegateKey = new PublicKey(d.subarray(off, off + 32));
  off += 32;
  const maxPerTx = readU64LE(d, off);
  off += 8;
  const maxDaily = readU64LE(d, off);
  off += 8;
  const expiresAt = readI64LE(d, off);
  off += 8;
  const spentToday = readU64LE(d, off);
  off += 8;
  const lastResetUnix = readI64LE(d, off);
  return {
    owner: ownerKey,
    delegate: delegateKey,
    maxPerTx,
    maxDaily,
    expiresAt,
    spentToday,
    lastResetUnix,
  };
}

export function ixUpdatePolicy(
  owner: PublicKey,
  maxPerTx: bigint,
  maxDaily: bigint,
  autoApproveUnder: bigint,
  secondhandFirst: boolean
): TransactionInstruction {
  const [policy] = policyPda(owner);

  const args = Buffer.alloc(8 + 8 + 8 + 1);
  writeU64LE(args, maxPerTx, 0);
  writeU64LE(args, maxDaily, 8);
  writeU64LE(args, autoApproveUnder, 16);
  args.writeUInt8(secondhandFirst ? 1 : 0, 24);

  return new TransactionInstruction({
    programId: SPENDING_POLICY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([ixDisc("update_policy"), args]),
  });
}

export interface PolicyConfig {
  owner: PublicKey;
  maxPerTx: bigint;
  maxDaily: bigint;
  autoApproveUnder: bigint;
  secondhandFirst: boolean;
}

export interface DailyState {
  spent: bigint;
  lastResetUnix: bigint;
}

export async function fetchPolicy(
  conn: Connection,
  owner: PublicKey
): Promise<PolicyConfig | null> {
  const [policy] = policyPda(owner);
  const acc = await conn.getAccountInfo(policy);
  if (!acc) return null;
  const d = acc.data;
  // skip 8-byte discriminator
  let off = 8;
  const ownerKey = new PublicKey(d.subarray(off, off + 32));
  off += 32;
  const maxPerTx = readU64LE(d, off);
  off += 8;
  const maxDaily = readU64LE(d, off);
  off += 8;
  const autoApproveUnder = readU64LE(d, off);
  off += 8;
  const secondhandFirst = d.readUInt8(off) === 1;
  return { owner: ownerKey, maxPerTx, maxDaily, autoApproveUnder, secondhandFirst };
}

export async function fetchDaily(
  conn: Connection,
  owner: PublicKey
): Promise<DailyState | null> {
  const [daily] = dailyPda(owner);
  const acc = await conn.getAccountInfo(daily);
  if (!acc) return null;
  const d = acc.data;
  let off = 8;
  const spent = readU64LE(d, off);
  off += 8;
  const lastResetUnix = readI64LE(d, off);
  return { spent, lastResetUnix };
}

// ============================================================
// digital_twin
// ============================================================

export enum Undertone {
  Cool = 0,
  Warm = 1,
  Neutral = 2,
}

/**
 * Shopping section — drives product-search filtering. Decoupled from gender
 * identity so the user picks WHERE to shop, not who they are.
 */
export type Section = "mens" | "womens" | "both" | "androgynous";

/**
 * Style register — drives commentary tone, not products. Independent of section
 * (a femme person shopping in men's still wants "softer drape" language).
 */
export type StyleRegister = "masculine" | "neutral" | "feminine";

/** Climate gates seasonal recommendations. */
export type Climate = "tropical" | "temperate" | "cold" | "four-season";

export type AgeRange =
  | "16-24"
  | "25-34"
  | "35-44"
  | "45-54"
  | "55+"
  | "decline";

export interface TwinParams {
  // Core measurements (always present)
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  shoulderCm: number;
  undertone: Undertone;
  skinTone: number; // 1..10
  stylePrefs: string;
  favColors: string;

  // Personalization v2 — optional. Persisted in encrypted blob; ignored on
  // legacy plaintext on-chain writes (so the seeded twin doesn't break).
  section?: Section;
  styleRegister?: StyleRegister;
  climate?: Climate;
  ageRange?: AgeRange;
  brandsLove?: string;   // free text, comma-separated
  brandsAvoid?: string;
  hardFilters?: string[]; // e.g. ["vegan", "no-fur", "no-fast-fashion"]
}

export interface Twin extends TwinParams {
  owner: PublicKey;
  createdAt: bigint;
  updatedAt: bigint;
}

function encodeTwinParams(p: TwinParams): Buffer {
  // 7 u16 measurements + 1 byte undertone enum + 1 byte skin_tone
  // + (4 + N) for style_prefs + (4 + N) for fav_colors
  const stylePrefsBuf = Buffer.from(p.stylePrefs, "utf8");
  const favColorsBuf = Buffer.from(p.favColors, "utf8");

  const buf = Buffer.alloc(
    7 * 2 + 1 + 1 + 4 + stylePrefsBuf.length + 4 + favColorsBuf.length
  );
  let off = 0;
  buf.writeUInt16LE(p.heightCm, off); off += 2;
  buf.writeUInt16LE(p.weightKg, off); off += 2;
  buf.writeUInt16LE(p.chestCm, off); off += 2;
  buf.writeUInt16LE(p.waistCm, off); off += 2;
  buf.writeUInt16LE(p.hipCm, off); off += 2;
  buf.writeUInt16LE(p.inseamCm, off); off += 2;
  buf.writeUInt16LE(p.shoulderCm, off); off += 2;
  buf.writeUInt8(p.undertone, off); off += 1;
  buf.writeUInt8(p.skinTone, off); off += 1;
  buf.writeUInt32LE(stylePrefsBuf.length, off); off += 4;
  stylePrefsBuf.copy(buf, off); off += stylePrefsBuf.length;
  buf.writeUInt32LE(favColorsBuf.length, off); off += 4;
  favColorsBuf.copy(buf, off);
  return buf;
}

export function ixCreateTwin(
  owner: PublicKey,
  params: TwinParams
): TransactionInstruction {
  const [twin] = twinPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: twin, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("create_twin"), encodeTwinParams(params)]),
  });
}

export function ixUpdateTwin(
  owner: PublicKey,
  params: TwinParams
): TransactionInstruction {
  const [twin] = twinPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: twin, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([ixDisc("update_twin"), encodeTwinParams(params)]),
  });
}

export function ixDeleteTwin(owner: PublicKey): TransactionInstruction {
  const [twin] = twinPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: twin, isSigner: false, isWritable: true },
    ],
    data: ixDisc("delete_twin"),
  });
}

// ============================================================
// EncryptedTwin instructions + reads
// ============================================================

export enum TwinState {
  Pending = 0,
  Encrypted = 1,
}

export interface EncryptedTwin {
  owner: PublicKey;
  state: TwinState;
  encryptedBlob: Uint8Array;
  nonce: Uint8Array; // 24 bytes
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * Treasury-signed instruction to create an empty encrypted twin PDA on a user's behalf.
 * The user does not need to sign here — only the paymaster (treasury) does.
 */
export function ixInitPendingTwin(
  paymaster: PublicKey,
  user: PublicKey
): TransactionInstruction {
  const [twin] = encryptedTwinPda(user);
  const args = Buffer.alloc(32);
  user.toBuffer().copy(args);

  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: paymaster, isSigner: true, isWritable: true },
      { pubkey: twin, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("init_pending_twin"), args]),
  });
}

function encodeBlobAndNonce(blob: Uint8Array, nonce: Uint8Array): Buffer {
  if (nonce.length !== 24) {
    throw new Error("nonce must be 24 bytes");
  }
  const buf = Buffer.alloc(4 + blob.length + 24);
  buf.writeUInt32LE(blob.length, 0);
  Buffer.from(blob).copy(buf, 4);
  Buffer.from(nonce).copy(buf, 4 + blob.length);
  return buf;
}

export function ixCompleteTwinEncrypted(
  owner: PublicKey,
  blob: Uint8Array,
  nonce: Uint8Array
): TransactionInstruction {
  const [twin] = encryptedTwinPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: twin, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      ixDisc("complete_twin_encrypted"),
      encodeBlobAndNonce(blob, nonce),
    ]),
  });
}

export function ixUpdateTwinEncrypted(
  owner: PublicKey,
  blob: Uint8Array,
  nonce: Uint8Array
): TransactionInstruction {
  const [twin] = encryptedTwinPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: twin, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      ixDisc("update_twin_encrypted"),
      encodeBlobAndNonce(blob, nonce),
    ]),
  });
}

// =============================================================================
// WatchPolicy — on-chain auto-buy bounds primitive
// =============================================================================

/** 0=mens 1=womens 2=both 3=androgynous 4=any */
export enum WatchSectionFilter {
  Mens = 0,
  Womens = 1,
  Both = 2,
  Androgynous = 3,
  Any = 4,
}
/** 0=masc 1=neutral 2=feminine 3=any */
export enum WatchRegisterFilter {
  Masculine = 0,
  Neutral = 1,
  Feminine = 2,
  Any = 3,
}
/** 0=notify 1=auto-buy-under-cap 2=auto-buy-full */
export enum WatchPolicyMode {
  NotifyOnly = 0,
  AutoBuyUnderCap = 1,
  AutoBuyFull = 2,
}

export interface WatchPolicyAccount {
  owner: PublicKey;
  celebs: string[];
  sectionFilter: WatchSectionFilter;
  registerFilter: WatchRegisterFilter;
  mode: WatchPolicyMode;
  maxPerLookUsd: bigint;
  eventScope: string | null;
  createdAt: bigint;
  updatedAt: bigint;
}

/** Anchor borsh: Vec<String> = u32 length + N * (u32 length + utf8 bytes) */
function encodeStringVec(items: string[]): Buffer {
  const parts: Buffer[] = [];
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(items.length, 0);
  parts.push(lenBuf);
  for (const s of items) {
    const sb = Buffer.from(s, "utf8");
    const sl = Buffer.alloc(4);
    sl.writeUInt32LE(sb.length, 0);
    parts.push(sl, sb);
  }
  return Buffer.concat(parts);
}

/** Anchor borsh Option<String>: 1 byte tag + (if Some: u32 len + utf8 bytes) */
function encodeOptionString(s: string | null): Buffer {
  if (s === null) return Buffer.from([0]);
  const sb = Buffer.from(s, "utf8");
  const out = Buffer.alloc(1 + 4 + sb.length);
  out.writeUInt8(1, 0);
  out.writeUInt32LE(sb.length, 1);
  sb.copy(out, 5);
  return out;
}

export function ixSetWatchPolicy(
  owner: PublicKey,
  celebs: string[],
  sectionFilter: WatchSectionFilter,
  registerFilter: WatchRegisterFilter,
  mode: WatchPolicyMode,
  maxPerLookUsd: bigint,
  eventScope: string | null
): TransactionInstruction {
  const [watch] = watchPolicyPda(owner);
  const cap = Buffer.alloc(8);
  writeU64LE(cap, maxPerLookUsd, 0);

  const data = Buffer.concat([
    ixDisc("set_watch_policy"),
    encodeStringVec(celebs),
    Buffer.from([sectionFilter, registerFilter, mode]),
    cap,
    encodeOptionString(eventScope),
  ]);

  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: watch, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function ixClearWatchPolicy(owner: PublicKey): TransactionInstruction {
  const [watch] = watchPolicyPda(owner);
  return new TransactionInstruction({
    programId: DIGITAL_TWIN_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: watch, isSigner: false, isWritable: true },
    ],
    data: ixDisc("clear_watch_policy"),
  });
}

export async function fetchWatchPolicy(
  conn: Connection,
  owner: PublicKey
): Promise<WatchPolicyAccount | null> {
  const [addr] = watchPolicyPda(owner);
  const acc = await conn.getAccountInfo(addr);
  if (!acc) return null;
  const d = acc.data;
  let off = 8; // discriminator
  const ownerKey = new PublicKey(d.subarray(off, off + 32));
  off += 32;
  const celebCount = d.readUInt32LE(off);
  off += 4;
  const celebs: string[] = [];
  for (let i = 0; i < celebCount; i++) {
    const sl = d.readUInt32LE(off);
    off += 4;
    celebs.push(d.subarray(off, off + sl).toString("utf8"));
    off += sl;
  }
  const sectionFilter = d.readUInt8(off) as WatchSectionFilter;
  off += 1;
  const registerFilter = d.readUInt8(off) as WatchRegisterFilter;
  off += 1;
  const mode = d.readUInt8(off) as WatchPolicyMode;
  off += 1;
  const maxPerLookUsd = readU64LE(d, off);
  off += 8;
  const hasScope = d.readUInt8(off);
  off += 1;
  let eventScope: string | null = null;
  if (hasScope === 1) {
    const sl = d.readUInt32LE(off);
    off += 4;
    eventScope = d.subarray(off, off + sl).toString("utf8");
    off += sl;
  }
  const createdAt = readI64LE(d, off);
  off += 8;
  const updatedAt = readI64LE(d, off);
  return {
    owner: ownerKey,
    celebs,
    sectionFilter,
    registerFilter,
    mode,
    maxPerLookUsd,
    eventScope,
    createdAt,
    updatedAt,
  };
}

export async function fetchEncryptedTwin(
  conn: Connection,
  owner: PublicKey
): Promise<EncryptedTwin | null> {
  const [twinAddr] = encryptedTwinPda(owner);
  const acc = await conn.getAccountInfo(twinAddr);
  if (!acc) return null;
  const d = acc.data;
  let off = 8; // discriminator
  const ownerKey = new PublicKey(d.subarray(off, off + 32));
  off += 32;
  const state = d.readUInt8(off) as TwinState;
  off += 1;
  const blobLen = d.readUInt32LE(off);
  off += 4;
  const encryptedBlob = new Uint8Array(d.subarray(off, off + blobLen));
  off += blobLen;
  const nonce = new Uint8Array(d.subarray(off, off + 24));
  off += 24;
  const createdAt = readI64LE(d, off);
  off += 8;
  const updatedAt = readI64LE(d, off);
  return { owner: ownerKey, state, encryptedBlob, nonce, createdAt, updatedAt };
}

export async function fetchTwin(
  conn: Connection,
  owner: PublicKey
): Promise<Twin | null> {
  const [twinAddr] = twinPda(owner);
  const acc = await conn.getAccountInfo(twinAddr);
  if (!acc) return null;
  const d = acc.data;
  let off = 8;
  const ownerKey = new PublicKey(d.subarray(off, off + 32)); off += 32;
  const heightCm = d.readUInt16LE(off); off += 2;
  const weightKg = d.readUInt16LE(off); off += 2;
  const chestCm = d.readUInt16LE(off); off += 2;
  const waistCm = d.readUInt16LE(off); off += 2;
  const hipCm = d.readUInt16LE(off); off += 2;
  const inseamCm = d.readUInt16LE(off); off += 2;
  const shoulderCm = d.readUInt16LE(off); off += 2;
  const undertone = d.readUInt8(off) as Undertone; off += 1;
  const skinTone = d.readUInt8(off); off += 1;
  const stylePrefsLen = d.readUInt32LE(off); off += 4;
  const stylePrefs = d.subarray(off, off + stylePrefsLen).toString("utf8"); off += stylePrefsLen;
  const favColorsLen = d.readUInt32LE(off); off += 4;
  const favColors = d.subarray(off, off + favColorsLen).toString("utf8"); off += favColorsLen;
  const createdAt = readI64LE(d, off); off += 8;
  const updatedAt = readI64LE(d, off);
  return {
    owner: ownerKey,
    heightCm, weightKg, chestCm, waistCm, hipCm, inseamCm, shoulderCm,
    undertone, skinTone, stylePrefs, favColors, createdAt, updatedAt,
  };
}

// ============================================================
// stylist_marketplace
// ============================================================

export interface StylistProfile {
  stylist: PublicKey;
  handle: string;
  bio: string;
  feePerMonth: bigint;
  payoutTokenAccount: PublicKey;
  subscriberCount: number;
}

function decodeString(d: Buffer, off: number): { value: string; next: number } {
  const len = d.readUInt32LE(off);
  const next = off + 4 + len;
  return { value: d.subarray(off + 4, next).toString("utf8"), next };
}

function decodeStylistProfile(d: Buffer): StylistProfile {
  let off = 8; // skip discriminator
  const stylist = new PublicKey(d.subarray(off, off + 32)); off += 32;
  const handleR = decodeString(d, off); off = handleR.next;
  const bioR = decodeString(d, off); off = bioR.next;
  const feePerMonth = readU64LE(d, off); off += 8;
  const payoutTokenAccount = new PublicKey(d.subarray(off, off + 32)); off += 32;
  const subscriberCount = d.readUInt32LE(off);
  return {
    stylist,
    handle: handleR.value,
    bio: bioR.value,
    feePerMonth,
    payoutTokenAccount,
    subscriberCount,
  };
}

export async function fetchAllStylistProfiles(
  conn: Connection
): Promise<StylistProfile[]> {
  const accounts = await conn.getProgramAccounts(
    STYLIST_MARKETPLACE_PROGRAM_ID,
    {
      filters: [
        { memcmp: { offset: 0, bytes: bs58Encode(accountDisc("StylistProfile")) } },
      ],
    }
  );
  return accounts.map((a) => decodeStylistProfile(a.account.data));
}

export async function fetchStylistProfile(
  conn: Connection,
  stylist: PublicKey
): Promise<StylistProfile | null> {
  const [profile] = stylistProfilePda(stylist);
  const acc = await conn.getAccountInfo(profile);
  if (!acc) return null;
  return decodeStylistProfile(acc.data);
}

// minimal base58 encoder used only for memcmp filter values
function bs58Encode(buf: Buffer): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(0);
  const eight = BigInt(8);
  const fiftyEight = BigInt(58);
  for (const b of buf) value = (value << eight) + BigInt(b);
  let out = "";
  while (value > BigInt(0)) {
    const r = value % fiftyEight;
    value = value / fiftyEight;
    out = ALPHABET[Number(r)] + out;
  }
  for (const b of buf) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

export function ixCreateStylistProfile(
  stylist: PublicKey,
  payoutTokenAccount: PublicKey,
  handle: string,
  bio: string,
  feePerMonth: bigint
): TransactionInstruction {
  const [profile] = stylistProfilePda(stylist);

  const handleBuf = Buffer.from(handle, "utf8");
  const bioBuf = Buffer.from(bio, "utf8");
  const args = Buffer.alloc(4 + handleBuf.length + 4 + bioBuf.length + 8);
  let off = 0;
  args.writeUInt32LE(handleBuf.length, off); off += 4;
  handleBuf.copy(args, off); off += handleBuf.length;
  args.writeUInt32LE(bioBuf.length, off); off += 4;
  bioBuf.copy(args, off); off += bioBuf.length;
  writeU64LE(args, feePerMonth, off);

  return new TransactionInstruction({
    programId: STYLIST_MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: stylist, isSigner: true, isWritable: true },
      { pubkey: profile, isSigner: false, isWritable: true },
      { pubkey: payoutTokenAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([ixDisc("create_profile"), args]),
  });
}

export function ixSubscribe(
  subscriber: PublicKey,
  stylistKey: PublicKey,
  subscriberTokenAccount: PublicKey,
  stylistTokenAccount: PublicKey,
  treasuryTokenAccount: PublicKey
): TransactionInstruction {
  const [profile] = stylistProfilePda(stylistKey);
  const [subscription] = subscriptionPda(subscriber, stylistKey);

  return new TransactionInstruction({
    programId: STYLIST_MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: subscriber, isSigner: true, isWritable: true },
      { pubkey: stylistKey, isSigner: false, isWritable: false },
      { pubkey: profile, isSigner: false, isWritable: true },
      { pubkey: subscription, isSigner: false, isWritable: true },
      { pubkey: subscriberTokenAccount, isSigner: false, isWritable: true },
      { pubkey: stylistTokenAccount, isSigner: false, isWritable: true },
      { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixDisc("subscribe"),
  });
}

// ============================================================
// USDC SPL transfer (helper for purchase flow)
// ============================================================

/**
 * Build an SPL transfer for any stablecoin mint we support.
 * Defaults to USDC for backwards compatibility with the original purchase path.
 */
export function ixTransferStable(
  from: PublicKey,
  to: PublicKey,
  amount: bigint,
  mint: PublicKey = USDC_MINT_DEVNET
): TransactionInstruction {
  const fromAta = getAssociatedTokenAddressSync(mint, from);
  const toAta = getAssociatedTokenAddressSync(mint, to);
  return createTransferInstruction(fromAta, toAta, from, amount, [], TOKEN_PROGRAM_ID);
}

// Legacy alias.
export const ixTransferUsdc = ixTransferStable;

// ============================================================
// Simulation helper — returns parsed return value of check_spend
// ============================================================

export async function simulateCheckSpend(
  conn: Connection,
  owner: PublicKey,
  amount: bigint
): Promise<{ autoApproved: boolean } | { error: string }> {
  const ix = ixCheckSpend(owner, amount);
  const tx = new Transaction().add(ix);
  tx.feePayer = owner;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sim = await conn.simulateTransaction(tx, undefined, [owner]);
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    const failed = logs.find((l) => l.includes("Error") || l.includes("AnchorError"));
    return { error: failed || JSON.stringify(sim.value.err) };
  }
  // Anchor encodes return values as base64 in the program return data
  const ret = sim.value.returnData?.data;
  if (!ret) return { autoApproved: false };
  const buf = Buffer.from(ret[0], "base64");
  return { autoApproved: buf[0] === 1 };
}
