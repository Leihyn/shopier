/**
 * Affiliate URL rewriter.
 *
 * Default: route through Skimlinks (one publisher ID, ~50K merchants covered).
 * Per-merchant override: when we have direct-program affiliate access for a
 * high-volume merchant, register a custom rewriter for that hostname.
 *
 * Demo / hackathon mode: when neither SKIMLINKS_PUBLISHER_ID is set nor a direct
 * program is registered, fall back to a self-hosted click tracker that logs the
 * click and 302s to the original URL. No money flows but attribution still works.
 */

const SKIMLINKS_BASE = "https://go.skimresources.com/?id=";
const SKIMLINKS_PUBLISHER_ID = process.env.SKIMLINKS_PUBLISHER_ID;

type DirectRewriter = (originalUrl: string, clickId: string) => string;

const DIRECT_PROGRAMS: Record<string, DirectRewriter> = {
  // Add per-merchant entries as direct affiliate IDs are obtained.
  // Example shape, not yet active:
  // "amazon.com": (url, clickId) =>
  //   `${url}${url.includes("?") ? "&" : "?"}tag=${process.env.AMAZON_AFFILIATE_TAG}&ascsubtag=${clickId}`,
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function affiliateRewrite(originalUrl: string, clickId: string): string {
  const host = hostnameOf(originalUrl);

  // Direct program override (highest priority — keeps 100% of commission)
  for (const merchantHost of Object.keys(DIRECT_PROGRAMS)) {
    if (host === merchantHost || host.endsWith(`.${merchantHost}`)) {
      return DIRECT_PROGRAMS[merchantHost](originalUrl, clickId);
    }
  }

  // Skimlinks default (when configured)
  if (SKIMLINKS_PUBLISHER_ID) {
    return `${SKIMLINKS_BASE}${SKIMLINKS_PUBLISHER_ID}&xs=1&xcust=${clickId}&url=${encodeURIComponent(originalUrl)}`;
  }

  // Demo fallback — clickId is appended as a query param the merchant ignores,
  // so the user lands on the merchant page. Server-side click log still records.
  const sep = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${sep}_shopier_click=${clickId}`;
}

export function affiliateConfigured(): boolean {
  return !!SKIMLINKS_PUBLISHER_ID || Object.keys(DIRECT_PROGRAMS).length > 0;
}

export function affiliateMode(): "skimlinks" | "direct-only" | "demo-fallback" {
  if (Object.keys(DIRECT_PROGRAMS).length > 0 && !SKIMLINKS_PUBLISHER_ID)
    return "direct-only";
  if (SKIMLINKS_PUBLISHER_ID) return "skimlinks";
  return "demo-fallback";
}

/**
 * Build the click-tracker URL that should be rendered in the breakdown card.
 * The user clicks this URL → server logs the click → 302 redirects to the
 * affiliate-rewritten merchant URL.
 */
export function clickTrackerUrl(
  originalUrl: string,
  options: { creatorHandle?: string | null; itemKey?: string }
): string {
  const params = new URLSearchParams({ to: originalUrl });
  if (options.creatorHandle) params.set("creator", options.creatorHandle);
  if (options.itemKey) params.set("item", options.itemKey);
  return `/api/affiliate/click?${params.toString()}`;
}
