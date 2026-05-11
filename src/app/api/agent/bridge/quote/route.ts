import { NextRequest, NextResponse } from "next/server";
import { pickBridge, type FulfillmentRequest } from "@/lib/bridges";

/**
 * Bridge selector endpoint.
 *
 * Given a purchase intent, returns the bridge that should handle fulfillment
 * along with its quote (deposit address, checkout URL, or order confirmation,
 * depending on adapter mode).
 *
 * v0 behavior: with no bridge env keys configured, the first adapter (Raenest)
 * returns a stub message confirming the v1 integration shape. Useful for the
 * /architecture demo to show the dispatcher exists without needing a live API.
 *
 * v1 behavior: a real Raenest or Crossmint adapter returns a real deposit
 * address. The client uses it as the destination for the USDC transfer.
 */
export async function POST(req: NextRequest) {
  let body: FulfillmentRequest;
  try {
    body = (await req.json()) as FulfillmentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.merchantUrl ||
    !body.itemTitle ||
    typeof body.amountUsd !== "number" ||
    !body.userPubkey
  ) {
    return NextResponse.json(
      {
        error:
          "Required: merchantUrl, itemTitle, amountUsd (number), userPubkey",
      },
      { status: 400 }
    );
  }

  const bridge = await pickBridge(body);

  if (!bridge) {
    return NextResponse.json({
      mode: "mock",
      via: "v0-mock",
      message:
        "No fulfillment bridge configured. v0 falls through to the on-chain " +
        "merchant-address mock (USDC moves to a Shopier-managed address; no " +
        "real merchandise ships). Configure RAENEST_API_KEY or CROSSMINT_API_KEY " +
        "to enable v1 fulfillment.",
    });
  }

  try {
    const result = await bridge.fulfill(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, via: bridge.name },
      { status: 502 }
    );
  }
}
