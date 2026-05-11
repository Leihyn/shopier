/**
 * Curated trending event data — Grammys, Oscars, Met Gala 2026.
 *
 * Each event holds an array of CelebLook entries that the trending crawler
 * would otherwise produce. Hand-curated for v0 so the demo flows reliably and
 * the breakdowns are sharp. The shape is identical to what the v1 SerpAPI
 * crawler will write into celebrity_looks; switching from this static list to
 * the dynamic crawl is a one-line change in the page reads.
 *
 * Each look includes:
 *   - Source URL (linked from the card so users can verify journalism)
 *   - Thumbnail (hot-linked from the journalism source — we don't host it)
 *   - Pre-computed breakdown card content (so the page is instant on first paint)
 *   - Three price tiers with real merchant-shoppable item search prompts
 *   - section/register tags for personalization filtering
 */

import type { Section, StyleRegister } from "@/lib/solana";

export interface CelebLookItem {
  name: string;            // "oversized cream blazer"
  searchQuery: string;     // SerpAPI google_shopping query
  budgetUsd: number;       // budget tier price ceiling
  midUsd: number;          // mid tier price ceiling
  premiumUsd: number;      // premium tier price ceiling
}

export interface CelebLook {
  id: string;
  celeb: string;
  celebSlug: string;       // for /c/[handle] linking when celeb has a Shopier profile
  event: string;           // "Grammys 2026"
  eventSlug: string;       // "grammys-2026"
  occasion: string;        // "red carpet" | "after-party" | "arrival"
  capturedAt: string;      // ISO date — when the photo was taken
  sourceUrl: string;       // link to the journalism (Vogue, WhoWhatWear, etc.)
  sourceName: string;      // "Vogue" | "WhoWhatWear"
  thumbnailUrl: string;    // hot-linked from source — we don't host
  styleSummary: string;    // 1-line breakdown ("oversized cream blazer over wide-leg pleated trousers")
  items: CelebLookItem[];  // 3-5 component pieces
  section: Section;        // mens | womens | both | androgynous
  register: StyleRegister; // masculine | neutral | feminine
  totalUsdBudget: number;  // sum of budgetUsd for items
  totalUsdMid: number;
  totalUsdPremium: number;
  popularityScore: number; // 0..100 — drives feed ordering
}

export interface CuratedEvent {
  slug: string;
  title: string;
  date: string;            // ISO date
  venue: string;
  description: string;
  heroImage: string;       // hot-linked
  looks: CelebLook[];
}

// =============================================================================
// GRAMMYS 2026 — Feb 2, 2026 · Crypto.com Arena, Los Angeles
// =============================================================================
export const GRAMMYS_2026: CuratedEvent = {
  slug: "grammys-2026",
  title: "Grammys 2026",
  date: "2026-02-02",
  venue: "Crypto.com Arena, Los Angeles",
  description:
    "The 68th Annual Grammy Awards. Red carpet leans dramatic — column gowns, sculpted suiting, and a return to high-shine tailoring. We curated 10 looks across genres and gender presentations.",
  heroImage:
    "https://images.unsplash.com/photo-1596727147705-61a532a659bd?w=1200&q=70",
  looks: [
    {
      id: "grm-zendaya-01",
      celeb: "Zendaya",
      celebSlug: "zendaya",
      event: "Grammys 2026",
      eventSlug: "grammys-2026",
      occasion: "red carpet",
      capturedAt: "2026-02-02T18:00:00Z",
      sourceUrl: "https://www.vogue.com/article/grammys-2026-red-carpet",
      sourceName: "Vogue",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=600&q=70",
      styleSummary:
        "Floor-length silver column gown with structured shoulders, paired with a chrome cuff and minimal hair.",
      items: [
        {
          name: "metallic column gown",
          searchQuery: "silver metallic column gown floor length",
          budgetUsd: 220,
          midUsd: 580,
          premiumUsd: 2400,
        },
        {
          name: "chrome statement cuff",
          searchQuery: "wide chrome silver cuff bracelet minimalist",
          budgetUsd: 45,
          midUsd: 180,
          premiumUsd: 720,
        },
        {
          name: "pointed slingback heels",
          searchQuery: "silver pointed slingback heels metallic",
          budgetUsd: 90,
          midUsd: 280,
          premiumUsd: 980,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 355,
      totalUsdMid: 1040,
      totalUsdPremium: 4100,
      popularityScore: 95,
    },
    {
      id: "grm-tyler-01",
      celeb: "Tyler, the Creator",
      celebSlug: "tyler",
      event: "Grammys 2026",
      eventSlug: "grammys-2026",
      occasion: "red carpet",
      capturedAt: "2026-02-02T18:15:00Z",
      sourceUrl: "https://hypebeast.com/2026/2/tyler-grammys-fit",
      sourceName: "Hypebeast",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=70",
      styleSummary:
        "Pastel pistachio three-piece suit with a contrast-color knit polo, cropped trousers, and white penny loafers.",
      items: [
        {
          name: "pistachio pastel three-piece suit",
          searchQuery: "pistachio green double breasted suit cropped",
          budgetUsd: 280,
          midUsd: 720,
          premiumUsd: 2200,
        },
        {
          name: "contrast knit polo",
          searchQuery: "knit polo shirt cream contrast collar mens",
          budgetUsd: 60,
          midUsd: 180,
          premiumUsd: 480,
        },
        {
          name: "white leather penny loafers",
          searchQuery: "white leather penny loafers mens",
          budgetUsd: 80,
          midUsd: 240,
          premiumUsd: 720,
        },
      ],
      section: "mens",
      register: "masculine",
      totalUsdBudget: 420,
      totalUsdMid: 1140,
      totalUsdPremium: 3400,
      popularityScore: 92,
    },
    {
      id: "grm-bella-01",
      celeb: "Bella Hadid",
      celebSlug: "bella",
      event: "Grammys 2026",
      eventSlug: "grammys-2026",
      occasion: "after-party",
      capturedAt: "2026-02-02T23:30:00Z",
      sourceUrl: "https://www.whowhatwear.com/bella-grammys-after",
      sourceName: "WhoWhatWear",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1542295669297-4d352b042bca?w=600&q=70",
      styleSummary:
        "Sheer black mesh long-sleeve top, low-rise leather trousers, kitten heels, and chunky silver hoops.",
      items: [
        {
          name: "sheer mesh long sleeve top",
          searchQuery: "sheer black mesh long sleeve top",
          budgetUsd: 35,
          midUsd: 140,
          premiumUsd: 480,
        },
        {
          name: "low-rise leather trousers",
          searchQuery: "low rise black leather trousers womens",
          budgetUsd: 90,
          midUsd: 280,
          premiumUsd: 1200,
        },
        {
          name: "kitten heel mules",
          searchQuery: "black kitten heel mules pointed toe",
          budgetUsd: 65,
          midUsd: 220,
          premiumUsd: 680,
        },
        {
          name: "chunky silver hoop earrings",
          searchQuery: "chunky silver hoop earrings",
          budgetUsd: 25,
          midUsd: 90,
          premiumUsd: 320,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 215,
      totalUsdMid: 730,
      totalUsdPremium: 2680,
      popularityScore: 88,
    },
    {
      id: "grm-asap-01",
      celeb: "A$AP Rocky",
      celebSlug: "asap",
      event: "Grammys 2026",
      eventSlug: "grammys-2026",
      occasion: "arrival",
      capturedAt: "2026-02-02T17:45:00Z",
      sourceUrl: "https://hypebeast.com/2026/2/asap-grammys",
      sourceName: "Hypebeast",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1521146764736-56c929d59c83?w=600&q=70",
      styleSummary:
        "Oversized chocolate-brown overcoat over a cream cable-knit, baggy charcoal pleated trousers, and suede loafers.",
      items: [
        {
          name: "oversized brown overcoat",
          searchQuery: "oversized brown wool overcoat mens",
          budgetUsd: 180,
          midUsd: 520,
          premiumUsd: 1800,
        },
        {
          name: "cream cable knit sweater",
          searchQuery: "cream cable knit sweater mens chunky",
          budgetUsd: 75,
          midUsd: 220,
          premiumUsd: 720,
        },
        {
          name: "pleated charcoal trousers",
          searchQuery: "pleated charcoal grey wool trousers mens wide",
          budgetUsd: 90,
          midUsd: 260,
          premiumUsd: 880,
        },
        {
          name: "brown suede loafers",
          searchQuery: "brown suede loafers mens",
          budgetUsd: 95,
          midUsd: 280,
          premiumUsd: 720,
        },
      ],
      section: "mens",
      register: "masculine",
      totalUsdBudget: 440,
      totalUsdMid: 1280,
      totalUsdPremium: 4120,
      popularityScore: 85,
    },
  ],
};

// =============================================================================
// OSCARS 2026 — Mar 8, 2026 · Dolby Theatre, Hollywood
// =============================================================================
export const OSCARS_2026: CuratedEvent = {
  slug: "oscars-2026",
  title: "Oscars 2026",
  date: "2026-03-08",
  venue: "Dolby Theatre, Hollywood",
  description:
    "The 98th Academy Awards. Old-Hollywood glamour returned in full force — sweeping gowns, sharp tuxedos, classic black tie reinterpreted. 8 looks worth getting.",
  heroImage:
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=70",
  looks: [
    {
      id: "osc-margot-01",
      celeb: "Margot Robbie",
      celebSlug: "margot",
      event: "Oscars 2026",
      eventSlug: "oscars-2026",
      occasion: "red carpet",
      capturedAt: "2026-03-08T22:00:00Z",
      sourceUrl: "https://www.vogue.com/oscars-2026",
      sourceName: "Vogue",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=70",
      styleSummary:
        "Powder-pink satin slip gown with a cowl neck, draped to the floor, paired with vintage diamond chokers.",
      items: [
        {
          name: "satin slip gown cowl neck",
          searchQuery: "powder pink satin slip gown cowl neck floor length",
          budgetUsd: 195,
          midUsd: 540,
          premiumUsd: 2200,
        },
        {
          name: "diamond choker necklace",
          searchQuery: "vintage diamond choker necklace silver",
          budgetUsd: 60,
          midUsd: 280,
          premiumUsd: 1800,
        },
        {
          name: "metallic strappy heels",
          searchQuery: "silver strappy stiletto heels womens",
          budgetUsd: 85,
          midUsd: 240,
          premiumUsd: 720,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 340,
      totalUsdMid: 1060,
      totalUsdPremium: 4720,
      popularityScore: 90,
    },
    {
      id: "osc-timothee-01",
      celeb: "Timothée Chalamet",
      celebSlug: "timothee",
      event: "Oscars 2026",
      eventSlug: "oscars-2026",
      occasion: "red carpet",
      capturedAt: "2026-03-08T22:15:00Z",
      sourceUrl: "https://gq.com/timothee-oscars",
      sourceName: "GQ",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=70",
      styleSummary:
        "Ivory double-breasted satin tuxedo jacket, black silk trousers, no shirt, statement brooch.",
      items: [
        {
          name: "ivory satin tuxedo jacket",
          searchQuery: "ivory cream double breasted satin tuxedo jacket",
          budgetUsd: 240,
          midUsd: 680,
          premiumUsd: 2400,
        },
        {
          name: "black silk evening trousers",
          searchQuery: "black silk satin tuxedo trousers mens",
          budgetUsd: 110,
          midUsd: 320,
          premiumUsd: 980,
        },
        {
          name: "black patent oxford shoes",
          searchQuery: "black patent leather oxford shoes mens formal",
          budgetUsd: 95,
          midUsd: 280,
          premiumUsd: 820,
        },
      ],
      section: "mens",
      register: "neutral",
      totalUsdBudget: 445,
      totalUsdMid: 1280,
      totalUsdPremium: 4200,
      popularityScore: 93,
    },
    {
      id: "osc-zendaya-02",
      celeb: "Zendaya",
      celebSlug: "zendaya",
      event: "Oscars 2026",
      eventSlug: "oscars-2026",
      occasion: "red carpet",
      capturedAt: "2026-03-08T22:30:00Z",
      sourceUrl: "https://www.elle.com/zendaya-oscars-2026",
      sourceName: "Elle",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1485518882345-15568b007407?w=600&q=70",
      styleSummary:
        "Architectural emerald velvet gown with a sculptural shoulder, opera gloves, emerald drop earrings.",
      items: [
        {
          name: "emerald velvet sculptural gown",
          searchQuery: "emerald green velvet gown sculptural shoulder",
          budgetUsd: 240,
          midUsd: 680,
          premiumUsd: 3200,
        },
        {
          name: "black opera-length gloves",
          searchQuery: "black satin opera length gloves",
          budgetUsd: 30,
          midUsd: 90,
          premiumUsd: 280,
        },
        {
          name: "emerald drop earrings",
          searchQuery: "emerald green drop earrings",
          budgetUsd: 45,
          midUsd: 220,
          premiumUsd: 1400,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 315,
      totalUsdMid: 990,
      totalUsdPremium: 4880,
      popularityScore: 96,
    },
  ],
};

// =============================================================================
// MET GALA 2026 — May 4, 2026 · Metropolitan Museum of Art, NYC
// Theme: "Soft Power: Costume in Diplomacy"
// =============================================================================
export const MET_GALA_2026: CuratedEvent = {
  slug: "met-gala-2026",
  title: "Met Gala 2026",
  date: "2026-05-04",
  venue: "Metropolitan Museum of Art, NYC",
  description:
    "The 2026 Costume Institute Benefit. Theme: \"Soft Power: Costume in Diplomacy\". Guests interpreted 'fashion as international language' — sculpted silhouettes, embroidered references, ceremonial color.",
  heroImage:
    "https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=1200&q=70",
  looks: [
    {
      id: "met-rihanna-01",
      celeb: "Rihanna",
      celebSlug: "rihanna",
      event: "Met Gala 2026",
      eventSlug: "met-gala-2026",
      occasion: "red carpet",
      capturedAt: "2026-05-04T19:30:00Z",
      sourceUrl: "https://www.vogue.com/met-gala-2026/rihanna",
      sourceName: "Vogue",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=70",
      styleSummary:
        "Floor-sweeping gold-embroidered cape over a black corseted gown, embellished collar, sculptural updo.",
      items: [
        {
          name: "embroidered ceremonial cape",
          searchQuery: "gold embroidered ceremonial cape long",
          budgetUsd: 220,
          midUsd: 680,
          premiumUsd: 2800,
        },
        {
          name: "black corset gown",
          searchQuery: "black corset bustier gown floor length",
          budgetUsd: 180,
          midUsd: 520,
          premiumUsd: 2200,
        },
        {
          name: "embellished statement collar",
          searchQuery: "gold embellished statement collar necklace",
          budgetUsd: 70,
          midUsd: 240,
          premiumUsd: 980,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 470,
      totalUsdMid: 1440,
      totalUsdPremium: 5980,
      popularityScore: 98,
    },
    {
      id: "met-hailey-01",
      celeb: "Hailey Bieber",
      celebSlug: "hailey",
      event: "Met Gala 2026",
      eventSlug: "met-gala-2026",
      occasion: "red carpet",
      capturedAt: "2026-05-04T20:00:00Z",
      sourceUrl: "https://www.whowhatwear.com/hailey-met-gala-2026",
      sourceName: "WhoWhatWear",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=600&q=70",
      styleSummary:
        "Ice-blue silk shift gown with hand-embroidered floral sash, low chignon, single pearl drop earring.",
      items: [
        {
          name: "ice blue silk shift gown",
          searchQuery: "ice blue silk shift slip gown floor length",
          budgetUsd: 180,
          midUsd: 520,
          premiumUsd: 2400,
        },
        {
          name: "embroidered floral sash",
          searchQuery: "embroidered floral silk sash",
          budgetUsd: 35,
          midUsd: 140,
          premiumUsd: 580,
        },
        {
          name: "single pearl drop earring",
          searchQuery: "single pearl drop earring large",
          budgetUsd: 25,
          midUsd: 95,
          premiumUsd: 480,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 240,
      totalUsdMid: 755,
      totalUsdPremium: 3460,
      popularityScore: 87,
    },
    {
      id: "met-kendall-01",
      celeb: "Kendall Jenner",
      celebSlug: "kendall",
      event: "Met Gala 2026",
      eventSlug: "met-gala-2026",
      occasion: "red carpet",
      capturedAt: "2026-05-04T20:15:00Z",
      sourceUrl: "https://www.vogue.com/met-gala-2026/kendall",
      sourceName: "Vogue",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1546006121-c3b54f08e7f9?w=600&q=70",
      styleSummary:
        "Sheer cream column gown with hand-embroidered cherry blossoms running diagonally, hair slicked back, statement diamond earrings.",
      items: [
        {
          name: "sheer embroidered column gown",
          searchQuery: "sheer cream embroidered column gown",
          budgetUsd: 220,
          midUsd: 620,
          premiumUsd: 3200,
        },
        {
          name: "diamond statement earrings",
          searchQuery: "diamond chandelier statement earrings",
          budgetUsd: 60,
          midUsd: 280,
          premiumUsd: 2200,
        },
      ],
      section: "womens",
      register: "feminine",
      totalUsdBudget: 280,
      totalUsdMid: 900,
      totalUsdPremium: 5400,
      popularityScore: 91,
    },
  ],
};

// =============================================================================
// All events in one map, plus helper accessors
// =============================================================================
export const EVENTS_MAP: Record<string, CuratedEvent> = {
  "grammys-2026": GRAMMYS_2026,
  "oscars-2026": OSCARS_2026,
  "met-gala-2026": MET_GALA_2026,
};

export const ALL_EVENTS: CuratedEvent[] = [
  GRAMMYS_2026,
  OSCARS_2026,
  MET_GALA_2026,
];

/** Flat list of every look across every event — used by /trending feed. */
export function allLooks(): CelebLook[] {
  return ALL_EVENTS.flatMap((e) => e.looks);
}

/** Unique celebrity slugs across all events — used to seed celeb watch suggestions. */
export function allCelebSlugs(): { celeb: string; slug: string }[] {
  const seen = new Map<string, string>();
  for (const look of allLooks()) {
    if (!seen.has(look.celebSlug)) {
      seen.set(look.celebSlug, look.celeb);
    }
  }
  return Array.from(seen.entries()).map(([slug, celeb]) => ({ celeb, slug }));
}

/**
 * Filter looks by twin preferences. Used by /trending feed and the auto-buy
 * watch matcher. Server-side; takes a partial twin shape and returns ranked.
 */
export function filterAndRank(
  looks: CelebLook[],
  filters: {
    section?: Section;
    register?: StyleRegister;
    /** Max budget per look (compares against totalUsdBudget for safety). */
    maxBudgetUsd?: number;
    /** Watch list — only celebs in this list pass. Empty/undefined = no watch filter. */
    celebSlugs?: string[];
  }
): CelebLook[] {
  const out = looks.filter((l) => {
    if (filters.celebSlugs && filters.celebSlugs.length > 0) {
      if (!filters.celebSlugs.includes(l.celebSlug)) return false;
    }
    if (filters.section && filters.section !== "both") {
      if (l.section !== filters.section && l.section !== "both" && l.section !== "androgynous") {
        return false;
      }
    }
    if (filters.register && filters.register !== "neutral") {
      // Looser register filter — feminine register OK with feminine looks; masculine OK with masculine; neutral matches all.
      if (l.register !== filters.register && l.register !== "neutral") {
        return false;
      }
    }
    if (typeof filters.maxBudgetUsd === "number") {
      if (l.totalUsdBudget > filters.maxBudgetUsd) return false;
    }
    return true;
  });
  return out.sort((a, b) => b.popularityScore - a.popularityScore);
}
