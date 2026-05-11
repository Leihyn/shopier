import { NextRequest, NextResponse } from "next/server";
import { getInboxEntry, setInboxStatus } from "@/lib/watchesDb";

/**
 * Inbox entry lifecycle.
 *
 * GET    → fetch a single entry (used by countdown UI to verify state)
 * PATCH  → update status (cancel | bought)
 *
 * Body for PATCH: { action: "cancel" | "mark-bought", txSig?: string, wallet: string }
 *
 * v0 enforces ownership via the wallet param. v1 enforces via signed message
 * using the wallet's signMessage so the server can't be tricked into cancelling
 * for another user.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getInboxEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { action: "cancel" | "mark-bought"; txSig?: string; wallet: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const entry = getInboxEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (entry.walletPubkey !== body.wallet) {
    return NextResponse.json({ error: "wrong owner" }, { status: 403 });
  }
  if (entry.status !== "pending") {
    return NextResponse.json({ error: `cannot transition from ${entry.status}` }, { status: 409 });
  }
  if (body.action === "cancel") {
    setInboxStatus(id, "cancelled");
  } else if (body.action === "mark-bought") {
    if (!body.txSig) return NextResponse.json({ error: "txSig required" }, { status: 400 });
    setInboxStatus(id, "bought", body.txSig);
  } else {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
