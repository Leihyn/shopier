import { NextRequest, NextResponse } from "next/server";
import { getQuote, isValidMint } from "@/lib/jupiter";

/**
 * Jupiter quote endpoint — server-side proxy that the client calls when it
 * needs to swap into USDC before a purchase.
 *
 * Body: { inputMint, outputMint, amount (string, base units), slippageBps? }
 * Returns Jupiter's quote response which the client passes to /swap.
 *
 * Reasoning for routing through our server: lets us add caching, rate limiting,
 * and analytics on swap usage without leaking the full Jupiter API surface.
 * Today it's a thin passthrough.
 */
export async function POST(req: NextRequest) {
  let body: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidMint(body.inputMint) || !isValidMint(body.outputMint)) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }
  let amount: bigint;
  try {
    amount = BigInt(body.amount);
    if (amount <= 0n) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "amount must be a positive integer string in base units" },
      { status: 400 }
    );
  }

  const quote = await getQuote({
    inputMint: body.inputMint,
    outputMint: body.outputMint,
    amount,
    slippageBps: body.slippageBps,
  });
  if (!quote) {
    return NextResponse.json(
      { error: "Jupiter quote unavailable — try again or check route exists" },
      { status: 502 }
    );
  }
  return NextResponse.json(quote);
}
