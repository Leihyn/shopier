import { NextRequest, NextResponse } from "next/server";
import {
  searchGoogleShopping,
  bucketByTier,
  ScrapedProduct,
  Tier,
} from "@/lib/googleShopping";

function simplifyForSearch(name: string, color: string): string {
  const garmentTypes = [
    "sweater", "hoodie", "jacket", "blazer", "coat", "cardigan",
    "shirt", "t-shirt", "tee", "top", "blouse", "polo",
    "pants", "trousers", "jeans", "shorts", "chinos",
    "sneakers", "boots", "shoes", "loafers", "sandals", "heels",
    "sunglasses", "watch", "belt", "hat", "cap", "scarf",
    "earring", "necklace", "bracelet", "ring",
    "skirt", "dress", "vest",
  ];

  const lowerName = name.toLowerCase();
  const garment =
    garmentTypes.find((g) => lowerName.includes(g)) ||
    name.split(" ").pop() ||
    name;

  const simpleColor =
    color
      .replace(
        /\b(moss|dark|light|pale|bright|deep|dusty|muted|olive|sage|forest|navy|royal|baby|sky|midnight)\b/gi,
        ""
      )
      .replace(/tortoiseshell/i, "brown")
      .replace(/pinstripe[sd]?/i, "striped")
      .trim() ||
    color.split(" ").pop() ||
    "";

  return `${simpleColor} ${garment}`.trim();
}

const FALLBACK_RETAILERS: Record<Tier, { name: string; url: (q: string) => string }> = {
  exact: {
    name: "Google Shopping",
    url: (q) =>
      `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
        q
      )}&tbs=mr:1,price:1,ppr_max:10000`,
  },
  mid: {
    name: "Google Shopping",
    url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
  },
  budget: {
    name: "Google Shopping",
    url: (q) =>
      `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
        q + " under 50"
      )}`,
  },
};

interface Alternative {
  name: string;
  brand: string;
  price: number;
  tier: Tier;
  retailer: string;
  url: string;
  color: string;
  thumbnail?: string;
}

function toAlts(
  products: ScrapedProduct[],
  tier: Tier,
  itemColor: string,
  fallbackQuery: string
): Alternative[] {
  return products.map((p) => ({
    name: p.title || fallbackQuery,
    brand: p.source || "Google Shopping",
    price: p.priceUsd,
    tier,
    retailer: p.source || "Google Shopping",
    url: p.link || FALLBACK_RETAILERS[tier].url(fallbackQuery),
    color: itemColor,
    thumbnail: p.thumbnail,
  }));
}

// Translate the user's section preference into a search-query prefix.
// Empty string for "both" / "androgynous" / unset — let the retailers decide.
function sectionPrefix(section: string | undefined): string {
  switch (section) {
    case "mens":
      return "men's ";
    case "womens":
      return "women's ";
    case "androgynous":
      return "unisex ";
    case "both":
    default:
      return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { items, twin } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const filtered = items.filter((item: { name: string }) => {
      const n = item.name.toLowerCase();
      return !["mug", "cup", "phone", "glass", "bottle"].some((s) =>
        n.includes(s)
      );
    });

    const prefix = sectionPrefix(twin?.section);

    const matches = await Promise.all(
      filtered.map(
        async (item: {
          name: string;
          category: string;
          color: string;
          style: string;
        }) => {
          const baseQuery = simplifyForSearch(item.name, item.color || "");
          // Section prefix gates which inventory section retailers search.
          // Accessories (sunglasses, watches, jewelry) often don't have gendered
          // sections, so we skip the prefix for those categories.
          const skipSection = ["accessory", "shoes"].includes(
            (item.category || "").toLowerCase()
          );
          const simpleQuery = skipSection ? baseQuery : `${prefix}${baseQuery}`.trim();
          let alternatives: Alternative[] = [];

          try {
            const scraped = await searchGoogleShopping(simpleQuery);
            const buckets = bucketByTier(scraped);
            alternatives = [
              ...toAlts(buckets.exact, "exact", item.color || "", simpleQuery),
              ...toAlts(buckets.mid, "mid", item.color || "", simpleQuery),
              ...toAlts(buckets.budget, "budget", item.color || "", simpleQuery),
            ];
          } catch (err) {
            console.error("Scrape failed for", simpleQuery, err);
          }

          // Honest empty-state: when product search returned nothing real,
          // show ONE search link per item (not three identical "matches" per tier).
          // The breakdown card detects empty alternatives and renders accordingly.
          if (alternatives.length === 0) {
            alternatives = [
              {
                name: `Search: ${simpleQuery}`,
                brand: "Google Shopping",
                price: 0,
                tier: "mid",
                retailer: "Google Shopping",
                url: FALLBACK_RETAILERS.mid.url(simpleQuery),
                color: item.color || "",
              },
            ];
          }

          return {
            originalItem: item.name,
            category: item.category,
            color: item.color,
            style: item.style,
            alternatives,
          };
        }
      )
    );

    return NextResponse.json({
      matches,
      apiCost: "$0.002",
      paidVia: "x402 on Stellar",
    });
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json(
      { error: "Failed to match products" },
      { status: 500 }
    );
  }
}
