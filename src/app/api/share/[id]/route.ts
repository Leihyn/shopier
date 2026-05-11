import { NextRequest, NextResponse } from "next/server";
import { consumeShare } from "@/lib/shareCache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = consumeShare(id);
  if (!entry) {
    return NextResponse.json(
      { error: "Share not found or expired" },
      { status: 404 }
    );
  }
  return NextResponse.json({
    imageBase64: entry.data,
    mimeType: entry.mimeType,
  });
}
