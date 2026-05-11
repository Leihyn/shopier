import { NextRequest, NextResponse } from "next/server";
import { storeShare } from "@/lib/shareCache";

// PWA share-target endpoint. Receives multipart from the OS share sheet,
// extracts the first image, hands off to /agent via a short-lived cache key.

async function fetchUrlAsImage(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Shopier-Share/0.1" },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const buf = await r.arrayBuffer();
    return {
      data: Buffer.from(buf).toString("base64"),
      mimeType: ct.split(";")[0],
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let imageBase64: string | null = null;
  let mimeType = "image/jpeg";
  let fallbackText: string | null = null;

  try {
    const formData = await req.formData();

    // Files first — share-target POST sends file blobs here
    const files = formData.getAll("files");
    for (const f of files) {
      if (f instanceof File && f.type.startsWith("image/")) {
        const buf = await f.arrayBuffer();
        imageBase64 = Buffer.from(buf).toString("base64");
        mimeType = f.type;
        break;
      }
    }

    // Fallback: text or URL points to an image we can fetch
    if (!imageBase64) {
      const url = formData.get("url");
      const text = formData.get("text");
      const candidate =
        (typeof url === "string" && url) ||
        (typeof text === "string" && text.match(/https?:\/\/\S+/)?.[0]);
      if (candidate) {
        const fetched = await fetchUrlAsImage(candidate);
        if (fetched) {
          imageBase64 = fetched.data;
          mimeType = fetched.mimeType;
        } else {
          fallbackText = candidate;
        }
      }
    }
  } catch (err) {
    console.error("share parse error", err);
  }

  if (imageBase64) {
    const id = storeShare(imageBase64, mimeType);
    return NextResponse.redirect(new URL(`/agent?share=${id}`, req.url), {
      status: 303,
    });
  }

  // No image — drop the user into /agent with a hint
  const fallback = fallbackText
    ? `?share_failed=${encodeURIComponent(fallbackText)}`
    : "";
  return NextResponse.redirect(new URL(`/agent${fallback}`, req.url), {
    status: 303,
  });
}

export async function GET(req: NextRequest) {
  // Some Android Chrome versions GET the share-target with query params. Honor it.
  const url = req.nextUrl.searchParams.get("url");
  const text = req.nextUrl.searchParams.get("text");
  const candidate =
    url || (text && text.match(/https?:\/\/\S+/)?.[0]) || null;

  if (candidate) {
    const fetched = await fetchUrlAsImage(candidate);
    if (fetched) {
      const id = storeShare(fetched.data, fetched.mimeType);
      return NextResponse.redirect(new URL(`/agent?share=${id}`, req.url));
    }
  }
  return NextResponse.redirect(new URL("/agent", req.url));
}
