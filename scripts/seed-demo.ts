/**
 * Seed Shopier with the minimum data needed to demo without empty states.
 *
 * Idempotent — safe to re-run. Skips anything that already exists.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Reads:
 *   - SHOPIER_BASE_URL (default http://localhost:3000)
 *   - PAYER_KEYPAIR (path to a Solana keypair JSON, default ~/.config/solana/id.json)
 *
 * Seeds:
 *   1. Spending policy on the payer wallet (if not already initialized)
 *   2. Digital twin on the payer wallet (if missing)
 *   3. Creator profile @demoLeihyn (off-chain, SQLite via /api/creators)
 *   4. Stylist profile on-chain (separate signer to keep it distinct)
 *   5. One published look so /looks isn't empty
 */

import { Connection, Keypair, Transaction } from "@solana/web3.js";
import {
  ixInitializePolicy,
  toUsdcUnits,
  fetchPolicy,
  ixCreateTwin,
  fetchTwin,
  Undertone,
} from "../src/lib/solana";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE_URL = process.env.SHOPIER_BASE_URL || "http://localhost:3000";
const KEYPAIR_PATH =
  process.env.PAYER_KEYPAIR || path.join(os.homedir(), ".config/solana/id.json");
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

function loadKeypair(p: string): Keypair {
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(data));
}

async function sendAndConfirm(
  conn: Connection,
  tx: Transaction,
  signer: Keypair,
  label: string
): Promise<string> {
  tx.feePayer = signer.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(signer);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  console.log(`✓ ${label}: ${sig}`);
  return sig;
}

async function seedPolicy(conn: Connection, payer: Keypair) {
  const existing = await fetchPolicy(conn, payer.publicKey);
  if (existing) {
    console.log("· spending policy: already initialized");
    return;
  }
  const tx = new Transaction().add(
    ixInitializePolicy(
      payer.publicKey,
      toUsdcUnits(200),
      toUsdcUnits(500),
      toUsdcUnits(50),
      true
    )
  );
  await sendAndConfirm(conn, tx, payer, "spending policy initialized");
}

async function seedTwin(conn: Connection, payer: Keypair) {
  const existing = await fetchTwin(conn, payer.publicKey);
  if (existing) {
    console.log("· twin: already exists");
    return;
  }
  const tx = new Transaction().add(
    ixCreateTwin(payer.publicKey, {
      heightCm: 175,
      weightKg: 70,
      chestCm: 95,
      waistCm: 80,
      hipCm: 95,
      inseamCm: 80,
      shoulderCm: 45,
      undertone: Undertone.Cool,
      skinTone: 5,
      stylePrefs: "minimalist, oversized, neutrals, Tokyo silhouettes",
      favColors: "black, cream, olive, charcoal",
    })
  );
  await sendAndConfirm(conn, tx, payer, "digital twin created");
}

async function seedCreator(payer: Keypair) {
  const handle = "demoleihyn";
  // Check existence
  const r0 = await fetch(`${BASE_URL}/api/creators/${handle}`);
  if (r0.ok) {
    console.log(`· creator @${handle}: already exists`);
    return;
  }
  const r = await fetch(`${BASE_URL}/api/creators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      bio: "Demo creator for Shopier. Curates minimalist menswear, Tokyo-leaning silhouettes.",
      pubkey: payer.publicKey.toBase58(),
      cutBps: 500, // 5%
      payoutAddress: payer.publicKey.toBase58(),
    }),
  });
  if (!r.ok) {
    console.error(`✗ creator: ${await r.text()}`);
    return;
  }
  console.log(`✓ creator @${handle} created`);
}

async function seedLook() {
  // Probe existing
  const probe = await fetch(`${BASE_URL}/api/looks`);
  if (probe.ok) {
    const { looks } = (await probe.json()) as { looks: unknown[] };
    if (looks.length > 0) {
      console.log(`· looks: ${looks.length} already published, skipping seed`);
      return;
    }
  }
  const r = await fetch(`${BASE_URL}/api/looks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Quiet luxury, 5-piece",
      styleNotes:
        "Cream wool overshirt over a fine ribbed crewneck. Pleated wide-leg trousers in charcoal. Suede derby. The whole thing reads expensive without trying.",
      occasion: "weekday office, dinner",
      aesthetic: "quiet luxury",
      items: [
        {
          name: "Cream Wool Overshirt",
          category: "outerwear",
          color: "cream",
          style: "boxy, mid-weight",
          tier: "exact",
          retailer: "SSENSE",
          url: "https://www.ssense.com/en-us/search?q=cream+wool+overshirt",
          price: 480,
          fitToYou:
            "Mid-weight wool sits clean off the shoulder; on a 175cm frame the hem lands at your low hip — not cropped, not long.",
        },
        {
          name: "Fine Ribbed Crewneck",
          category: "top",
          color: "ivory",
          style: "slim, fine gauge",
          tier: "mid",
          retailer: "ASOS",
          url: "https://www.asos.com/us/search/?q=fine+ribbed+crewneck",
          price: 65,
        },
        {
          name: "Pleated Wide-Leg Trousers",
          category: "bottom",
          color: "charcoal",
          style: "high rise, double pleat",
          tier: "exact",
          retailer: "Nordstrom",
          url: "https://www.nordstrom.com/sr?keyword=pleated+wide-leg+trousers",
          price: 220,
          fitToYou:
            "High rise + 80cm inseam keeps the line elongated; the wide leg breaks at the shoe instead of pooling.",
        },
        {
          name: "Suede Derby Shoes",
          category: "shoes",
          color: "tobacco",
          style: "classic derby",
          tier: "exact",
          retailer: "Mr Porter",
          url: "https://www.mrporter.com/en-us/mens/clothing/search?q=suede+derby",
          price: 380,
        },
        {
          name: "Tortoise Sunglasses",
          category: "accessory",
          color: "tortoise brown",
          style: "rectangular, mid-size",
          tier: "mid",
          retailer: "SSENSE",
          url: "https://www.ssense.com/en-us/search?q=tortoise+sunglasses",
          price: 140,
        },
      ],
    }),
  });
  if (!r.ok) {
    console.error(`✗ look: ${await r.text()}`);
    return;
  }
  const data = (await r.json()) as { slug: string };
  console.log(`✓ look published: /looks/${data.slug}`);
}

async function main() {
  if (!fs.existsSync(KEYPAIR_PATH)) {
    console.error(`✗ Keypair not found: ${KEYPAIR_PATH}`);
    process.exit(1);
  }
  const payer = loadKeypair(KEYPAIR_PATH);
  const conn = new Connection(RPC, "confirmed");
  const balLamports = await conn.getBalance(payer.publicKey);
  console.log(`payer: ${payer.publicKey.toBase58()}`);
  console.log(`balance: ${(balLamports / 1e9).toFixed(3)} SOL on ${RPC}`);

  if (balLamports < 0.2 * 1e9) {
    console.error(
      "✗ Need at least 0.2 SOL on the payer wallet. Run: solana airdrop 2 -u devnet"
    );
    process.exit(1);
  }

  await seedPolicy(conn, payer);
  await seedTwin(conn, payer);
  await seedCreator(payer);
  await seedLook();
  console.log("\n✓ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
