import { NextRequest, NextResponse } from "next/server";
import { analyzeWallet, zerionConfigured } from "@/lib/zerion";

/**
 * Wallet-analysis endpoint powered by Zerion CLI.
 * The agent uses this to read the user's full portfolio context before
 * suggesting outfits — e.g., to determine the right tier price ceiling.
 *
 * Auth: requires ZERION_API_KEY on the server.
 */
export async function POST(req: NextRequest) {
  if (!zerionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Zerion CLI not configured. Set ZERION_API_KEY in .env.local. Get a key at https://zerion.io/api",
      },
      { status: 503 }
    );
  }
  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "address required" },
        { status: 400 }
      );
    }
    const result = await analyzeWallet(address);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, stderr: result.stderr },
        { status: 502 }
      );
    }
    return NextResponse.json({ analysis: result.data });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
