/**
 * Product search across retailers.
 *
 * Primary: SerpAPI google_shopping engine. Returns structured JSON with
 *          direct merchant `product_link` URLs. Reliable, paid (~$50/mo for
 *          5000 queries; free tier 100/mo at signup).
 *
 * Fallback: legacy HTML scrape of google.com/search?tbm=shop. Was always
 *          fragile (Google rotates CSS classes + actively blocks scraping).
 *          Kept only for local dev when SERPAPI_KEY isn't set; will return
 *          empty array on most production IPs.
 *
 * Honest empty-state: when both sources return nothing, the match route
 * shows ONE "search Google Shopping" link per item rather than fabricating
 * three identical fake-match cards per tier.
 */

export interface ScrapedProduct {
  title: string;
  price: string;
  priceUsd: number;
  /** Direct merchant URL when available (SerpAPI product_link).
   *  Falls back to Google's redirect URL only when SerpAPI is off. */
  link: string;
  source: string;
  thumbnail: string;
}

export type Tier = "exact" | "mid" | "budget";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function isSerpApiConfigured(): boolean {
  return !!process.env.SERPAPI_KEY;
}

interface SerpApiShoppingResult {
  position?: number;
  title?: string;
  link?: string;          // Google Shopping redirect URL
  product_link?: string;  // direct retailer URL — what we want
  source?: string;        // merchant name (e.g. "SSENSE")
  price?: string;         // formatted price string
  extracted_price?: number;
  thumbnail?: string;
}

interface SerpApiResponse {
  shopping_results?: SerpApiShoppingResult[];
  error?: string;
}

async function searchViaSerpApi(
  query: string,
  limit: number
): Promise<ScrapedProduct[]> {
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: process.env.SERPAPI_KEY!,
    hl: "en",
    gl: "us",
    num: String(Math.min(limit, 60)),
  });
  const url = `https://serpapi.com/search?${params.toString()}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`SerpAPI ${res.status}:`, await res.text().catch(() => ""));
    return [];
  }
  const data = (await res.json()) as SerpApiResponse;
  if (data.error) {
    console.error("SerpAPI error:", data.error);
    return [];
  }
  const results = data.shopping_results ?? [];

  return results
    .map((r): ScrapedProduct | null => {
      const title = r.title?.trim();
      // Direct retailer URL preferred over Google's redirect.
      const link = (r.product_link || r.link || "").trim();
      const source = r.source?.trim() || "";
      const priceText = r.price?.trim() || "";
      const priceUsd =
        typeof r.extracted_price === "number"
          ? r.extracted_price
          : priceText
          ? parseFloat(priceText.replace(/[$,]/g, ""))
          : NaN;
      const thumbnail = r.thumbnail?.trim() || "";

      if (!title || !link) return null;
      return { title, price: priceText, priceUsd, link, source, thumbnail };
    })
    .filter((p): p is ScrapedProduct => p !== null)
    .slice(0, limit);
}

async function searchViaHtmlScrape(
  query: string,
  limit: number
): Promise<ScrapedProduct[]> {
  const url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
    query
  )}&hl=en&gl=us`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch {
    return [];
  }

  const html = await res.text();
  // Quick check: if Google blocked us, response is tiny + has no product blocks.
  if (html.length < 5_000 || !html.includes("sh-dgr__content")) {
    return [];
  }

  const products: ScrapedProduct[] = [];
  const productBlocks = html.split(/class="sh-dgr__content"/).slice(1);

  for (const block of productBlocks.slice(0, limit)) {
    const titleMatch = block.match(/class="tAxDx"[^>]*>([^<]+)</);
    const title = titleMatch?.[1] || "";

    const priceMatch = block.match(/\$[\d,]+(?:\.\d{2})?/);
    const priceText = priceMatch?.[0] || "";
    const priceUsd = priceText
      ? parseFloat(priceText.replace(/[$,]/g, ""))
      : NaN;

    const merchantMatch = block.match(/class="aULzUe"[^>]*>([^<]+)</);
    const source = merchantMatch?.[1] || "";

    const linkMatch = block.match(/href="(\/url\?[^"]+)"/);
    const rawLink = linkMatch?.[1] || "";
    const link = rawLink
      ? `https://www.google.com${rawLink.replace(/&amp;/g, "&")}`
      : "";

    const imgMatch = block.match(/src="(https:\/\/[^"]+)"/);
    const thumbnail = imgMatch?.[1] || "";

    if (title && priceText) {
      products.push({ title, price: priceText, priceUsd, link, source, thumbnail });
    }
  }

  return products;
}

export async function searchGoogleShopping(
  query: string,
  limit = 12
): Promise<ScrapedProduct[]> {
  if (isSerpApiConfigured()) {
    const serp = await searchViaSerpApi(query, limit);
    if (serp.length > 0) return serp;
    // SerpAPI returned empty — try HTML scrape as a hail-mary
  }
  return searchViaHtmlScrape(query, limit);
}

export function bucketByTier(
  products: ScrapedProduct[]
): Record<Tier, ScrapedProduct[]> {
  const valid = products.filter(
    (p) => Number.isFinite(p.priceUsd) && p.priceUsd > 0
  );
  if (valid.length === 0) {
    return { exact: [], mid: [], budget: [] };
  }

  const sorted = [...valid].sort((a, b) => a.priceUsd - b.priceUsd);
  const n = sorted.length;
  const t1 = Math.ceil(n / 3);
  const t2 = Math.ceil((2 * n) / 3);

  return {
    budget: sorted.slice(0, t1).slice(0, 2),
    mid: sorted.slice(t1, t2).slice(0, 2),
    exact: sorted.slice(t2).slice(0, 2),
  };
}
