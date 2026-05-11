import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/affiliateDb";
import { affiliateRewrite } from "@/lib/affiliate";

/**
 * Click tracker. Records the click + redirects to the affiliate-rewritten URL.
 *
 * Reads creator attribution from the query string OR the shopier_ref cookie
 * (whichever is present). Logs referrer + user-agent for debugging.
 *
 * This route is the *only* outbound link from breakdown cards. No raw merchant
 * URLs are exposed to users — we always pipe through here so attribution
 * lands consistently regardless of where the link was rendered.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "Missing 'to' param" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(to);
  } catch {
    return NextResponse.json({ error: "Invalid 'to' URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https" }, { status: 400 });
  }

  const cookieRef = req.cookies.get("shopier_ref")?.value;
  const queryCreator = req.nextUrl.searchParams.get("creator");
  const creatorHandle =
    queryCreator || (cookieRef ? decodeURIComponent(cookieRef) : null);

  const itemKey = req.nextUrl.searchParams.get("item") ?? undefined;
  const referrer = req.headers.get("referer");
  const userAgent = req.headers.get("user-agent");

  const clickId = recordClick({
    creatorHandle,
    originalUrl: to,
    itemKey,
    referrer,
    userAgent,
  });

  const dest = affiliateRewrite(to, clickId);
  return NextResponse.redirect(dest, { status: 302 });
}
