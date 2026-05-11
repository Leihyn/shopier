import { NextRequest, NextResponse } from "next/server";
import { getSwapTransaction } from "@/lib/jupiter";

/**
 * Jupiter swap endpoint — returns a serialized transaction the user signs.
 * Body: { quoteResponse, userPublicKey, wrapAndUnwrapSol? }
 * Returns: { swapTransaction (base64), lastValidBlockHeight }
 */
export async function POST(req: NextRequest) {
  let body: {
    quoteResponse: unknown;
    userPublicKey: string;
    wrapAndUnwrapSol?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.quoteResponse || !body.userPublicKey) {
    return NextResponse.json(
      { error: "quoteResponse and userPublicKey required" },
      { status: 400 }
    );
  }
  const result = await getSwapTransaction(body);
  if (!result) {
    return NextResponse.json(
      { error: "Jupiter swap-tx unavailable" },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
