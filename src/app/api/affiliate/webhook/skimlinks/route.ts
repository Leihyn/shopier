import { NextRequest, NextResponse } from "next/server";
import { recordSale } from "@/lib/affiliateDb";
import crypto from "crypto";

/**
 * Skimlinks postback webhook.
 *
 * Skimlinks posts conversions to this endpoint with the clickId we passed as
 * `xcust` on the redirect. We verify the shared secret signature then ingest
 * the sale, splitting commission to the creator who originated the click.
 *
 * Setup (after Skimlinks publisher approval):
 *   1. In Skimlinks dashboard → Postback configuration
 *   2. Set URL to: https://your-domain/api/affiliate/webhook/skimlinks
 *   3. Set shared secret matching SKIMLINKS_WEBHOOK_SECRET in env
 *   4. Map fields: clickId → xcust, sale_id → custom_id, etc.
 */

const WEBHOOK_SECRET = process.env.SKIMLINKS_WEBHOOK_SECRET;

interface SkimlinksPayload {
  xcust?: string;       // our clickId
  sale_id?: string;     // their unique sale identifier
  merchant?: string;
  sale_amount?: number; // gross sale in USD
  commission?: number;  // our commission in USD
  signature?: string;   // HMAC of the payload
}

function verifySignature(payload: SkimlinksPayload, secret: string): boolean {
  if (!payload.signature) return false;
  const { signature, ...rest } = payload;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  const computed = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");
  // Constant-time compare
  if (signature.length !== computed.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(computed, "utf8")
  );
}

export async function POST(req: NextRequest) {
  let payload: SkimlinksPayload;
  try {
    payload = (await req.json()) as SkimlinksPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (WEBHOOK_SECRET) {
    if (!verifySignature(payload, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "SKIMLINKS_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  if (
    !payload.sale_id ||
    !payload.merchant ||
    typeof payload.sale_amount !== "number" ||
    typeof payload.commission !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const result = recordSale({
    saleId: payload.sale_id,
    clickId: payload.xcust ?? null,
    merchant: payload.merchant,
    grossAmountUsd: payload.sale_amount,
    commissionAmountUsd: payload.commission,
  });

  return NextResponse.json({
    ok: true,
    creatorPayoutUsd: result.creatorPayoutUsd,
    shopierNetUsd: result.shopierNetUsd,
  });
}
