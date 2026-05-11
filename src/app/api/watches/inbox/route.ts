import { NextRequest, NextResponse } from "next/server";
import { listInboxForWallet } from "@/lib/watchesDb";

/**
 * Read the watch inbox for a wallet — pending matches, in-progress auto-buys,
 * and recently-bought receipts.
 *
 * The /trending and /events pages poll this every few seconds while the user
 * has the page open; once VAPID push lands in v1, this becomes a fallback.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }
  const entries = listInboxForWallet(wallet);
  return NextResponse.json({ entries });
}
