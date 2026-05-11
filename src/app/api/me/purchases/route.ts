import { NextRequest, NextResponse } from "next/server";
import { covalentConfigured, listWalletTransactions } from "@/lib/covalent";

const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS || "";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }

  if (!covalentConfigured()) {
    return NextResponse.json(
      {
        purchases: [],
        notice:
          "COVALENT_API_KEY not set on the server. Returning empty list. Get a key at https://goldrush.dev/",
      },
      { status: 200 }
    );
  }

  const result = await listWalletTransactions(wallet);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Filter for transfers TO our merchant address, presented as user purchases.
  const purchases = result.transactions
    .filter((t) => MERCHANT && t.to_address.toLowerCase() === MERCHANT.toLowerCase())
    .map((t) => ({
      txHash: t.tx_hash,
      timestamp: t.block_signed_at,
      amountUsd: Number(t.delta) / 10 ** t.contract_decimals,
      asset: t.contract_ticker_symbol,
    }));

  return NextResponse.json({ purchases, count: purchases.length });
}
