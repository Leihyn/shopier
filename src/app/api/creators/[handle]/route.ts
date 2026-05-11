import { NextRequest, NextResponse } from "next/server";
import { getCreator, getCreatorStats } from "@/lib/creatorsDb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stats = getCreatorStats(handle);
  return NextResponse.json({ creator: c, stats });
}
