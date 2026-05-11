import { NextRequest, NextResponse } from "next/server";

// Wired in task #12 — Solana SPL USDC + spending-policy program CPI.
// Until then: 501 with the request payload echoed for client-side dev.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    {
      error: "Solana purchase wiring pending (task #12)",
      payload: body,
    },
    { status: 501 }
  );
}
