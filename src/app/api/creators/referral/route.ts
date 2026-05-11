import { NextRequest, NextResponse } from "next/server";
import {
  recordReferral,
  attributeReferralPurchase,
  getCreator,
} from "@/lib/creatorsDb";

// Called by /c/[handle]/page.tsx on first landing (lightweight tag)
// and by usePurchase after a settled purchase to attribute commission.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const c = getCreator(body.handle);
    if (!c) {
      return NextResponse.json({ error: "Unknown creator" }, { status: 404 });
    }
    if (body.purchaseSignature && typeof body.purchaseAmountUsd === "number") {
      const commission = (body.purchaseAmountUsd * c.cutBps) / 10_000;
      attributeReferralPurchase({
        creatorHandle: c.handle,
        referredPubkey: body.referredPubkey || "anonymous",
        purchaseSignature: body.purchaseSignature,
        purchaseAmountUsd: body.purchaseAmountUsd,
        commissionAmountUsd: commission,
      });
      return NextResponse.json({ recorded: true, commission });
    }
    recordReferral({
      creatorHandle: c.handle,
      referredPubkey: body.referredPubkey || null,
    });
    return NextResponse.json({ recorded: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
