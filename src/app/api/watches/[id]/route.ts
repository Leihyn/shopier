import { NextRequest, NextResponse } from "next/server";
import { getWatch, revokeWatch } from "@/lib/watchesDb";

/**
 * Revoke (soft delete) a watch.
 *
 * DELETE /api/watches/<id>?wallet=<pubkey>
 *
 * The wallet param prevents one user from revoking another user's watches by
 * guessing IDs. v1 will replace this guard with on-chain ownership check.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }
  const watch = getWatch(id);
  if (!watch) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (watch.walletPubkey !== wallet) {
    return NextResponse.json({ error: "wrong owner" }, { status: 403 });
  }
  revokeWatch(id);
  return NextResponse.json({ revoked: true });
}
