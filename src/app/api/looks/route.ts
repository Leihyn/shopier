import { NextRequest, NextResponse } from "next/server";
import { createLook, listRecentLooks, type LookItem } from "@/lib/looksDb";
import { getCreator } from "@/lib/creatorsDb";
import {
  computeContentHash,
  verifyLookSignature,
} from "@/lib/lookSignature";

export async function GET() {
  const looks = listRecentLooks(24);
  return NextResponse.json({
    looks: looks.map((l) => ({
      slug: l.slug,
      title: l.title,
      aesthetic: l.aesthetic,
      itemCount: l.items.length,
      createdAt: l.createdAt,
      views: l.views,
      creatorHandle: l.creatorHandle,
      signed: !!l.signatureB58,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: LookItem[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "items[] required" },
        { status: 400 }
      );
    }

    const title =
      typeof body.title === "string" && body.title.length > 0
        ? body.title.slice(0, 200)
        : `${items.length}-piece look`;
    const styleNotes = typeof body.styleNotes === "string" ? body.styleNotes : "";
    const occasion = typeof body.occasion === "string" ? body.occasion : "";
    const aesthetic = typeof body.aesthetic === "string" ? body.aesthetic : "";

    // Optional curator attestation. If creatorHandle + signature present, verify.
    let creatorHandle: string | null = null;
    let signedByPubkey: string | null = null;
    let signatureB58: string | null = null;
    let contentHash: string | null = null;

    if (body.creatorHandle && body.signature && body.signedByPubkey) {
      const handle = String(body.creatorHandle).toLowerCase();
      const creator = getCreator(handle);
      if (!creator) {
        return NextResponse.json(
          { error: `Unknown creator @${handle}` },
          { status: 400 }
        );
      }
      // Pubkey on the signature must match the creator's registered wallet.
      if (creator.pubkey !== body.signedByPubkey) {
        return NextResponse.json(
          { error: "signedByPubkey does not match creator's registered wallet" },
          { status: 400 }
        );
      }
      contentHash = computeContentHash({
        title,
        styleNotes,
        occasion,
        aesthetic,
        items,
      });
      const valid = verifyLookSignature({
        creatorHandle: handle,
        contentHash,
        signedByPubkey: body.signedByPubkey,
        signatureB58: body.signature,
      });
      if (!valid) {
        return NextResponse.json(
          { error: "Look signature failed verification" },
          { status: 400 }
        );
      }
      creatorHandle = handle;
      signedByPubkey = body.signedByPubkey;
      signatureB58 = body.signature;
    }

    const look = createLook({
      ownerPubkey: typeof body.ownerPubkey === "string" ? body.ownerPubkey : null,
      title,
      styleNotes,
      occasion,
      aesthetic,
      items,
      sourceImageBase64:
        typeof body.sourceImageBase64 === "string"
          ? body.sourceImageBase64
          : null,
      creatorHandle,
      signedByPubkey,
      signatureB58,
      contentHash,
    });

    return NextResponse.json({
      slug: look.slug,
      url: `/looks/${look.slug}`,
      signed: !!signatureB58,
      creatorHandle,
    });
  } catch (err) {
    console.error("create look", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
