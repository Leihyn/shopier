import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createCreator, listCreators } from "@/lib/creatorsDb";
import { DEVNET_RPC } from "@/lib/solana";
import { normalizeSnsLabel, verifySnsOwnership } from "@/lib/sns";

export async function GET() {
  return NextResponse.json({ creators: listCreators(100) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Optional .sol verification. If a .sol is provided, we resolve it on-chain
    // and confirm the resolved owner matches the registering wallet. Mismatch =
    // reject. Unverifiable .sol input is dropped silently (creator registers
    // without a .sol identity rather than failing the whole flow).
    let dotsolName: string | null = null;
    if (body.dotsolName && typeof body.dotsolName === "string") {
      try {
        const conn = new Connection(DEVNET_RPC, "confirmed");
        const owner = new PublicKey(body.pubkey);
        const verified = await verifySnsOwnership(conn, body.dotsolName, owner);
        if (verified) {
          dotsolName = normalizeSnsLabel(body.dotsolName);
        } else {
          return NextResponse.json(
            {
              error: `.sol verification failed: ${body.dotsolName} is not owned by the connecting wallet`,
            },
            { status: 400 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { error: `.sol resolution error: ${(err as Error).message}` },
          { status: 400 }
        );
      }
    }

    const c = createCreator({
      handle: body.handle,
      pubkey: body.pubkey,
      bio: body.bio || "",
      cutBps: typeof body.cutBps === "number" ? body.cutBps : 500,
      payoutAddress: body.payoutAddress || body.pubkey,
      dotsolName,
    });
    return NextResponse.json({ creator: c });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
