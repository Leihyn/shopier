import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import {
  createWatch,
  listWatchesForWallet,
  type WatchMode,
} from "@/lib/watchesDb";

const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

/**
 * Watches CRUD.
 *
 * GET  /api/watches?wallet=<pubkey>     → list active watches for that wallet
 * POST /api/watches                      → create a watch
 *
 * v0 stores in SQLite. v1 will additionally call the on-chain
 * `set_watch_policy` instruction so the backend can prove the user signed it.
 */

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }
  const watches = listWatchesForWallet(wallet);
  return NextResponse.json({ watches });
}

export async function POST(req: NextRequest) {
  let body: {
    walletPubkey: string;
    celebSlug: string;
    celebName: string;
    sectionFilter?: string | null;
    registerFilter?: string | null;
    maxPerLookUsd: number;
    mode: WatchMode;
    eventScope?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.walletPubkey || !body.celebSlug || !body.celebName) {
    return NextResponse.json(
      { error: "walletPubkey, celebSlug, celebName required" },
      { status: 400 }
    );
  }
  if (
    !["notify", "auto-buy-under-cap", "auto-buy-full"].includes(body.mode)
  ) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (
    typeof body.maxPerLookUsd !== "number" ||
    body.maxPerLookUsd <= 0 ||
    body.maxPerLookUsd > 100_000
  ) {
    return NextResponse.json(
      { error: "maxPerLookUsd must be positive and ≤ 100000" },
      { status: 400 }
    );
  }

  const watch = createWatch({
    id: newId(),
    walletPubkey: body.walletPubkey,
    celebSlug: body.celebSlug,
    celebName: body.celebName,
    sectionFilter: body.sectionFilter ?? null,
    registerFilter: body.registerFilter ?? null,
    maxPerLookUsd: Math.round(body.maxPerLookUsd),
    mode: body.mode,
    eventScope: body.eventScope ?? null,
  });
  return NextResponse.json({ watch });
}
