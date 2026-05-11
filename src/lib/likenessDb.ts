/**
 * Likeness database — celebrities + their public-record body measurements.
 *
 * Used by the twin page to surface "your matches": celebrities whose body
 * type, height, and ratios are closest to the user's twin. The thesis: what
 * fits them tends to fit you, so their looks are a good starting point for
 * your shopping.
 *
 * Measurements are public-record approximations (Wikipedia / fan databases /
 * agency cards). Treated as illustrative, not authoritative — the demo
 * doesn't hinge on perfect numbers.
 *
 * Photos hot-linked to Unsplash silhouettes; we never host celebrity images.
 */

import type { Section, StyleRegister } from "@/lib/solana";

export type BodyType =
  | "rectangle"
  | "hourglass"
  | "pear"
  | "inverted-triangle"
  | "apple";

export interface CelebLikeness {
  name: string;
  slug: string; // matches eventsData celebSlug when applicable
  heightCm: number;
  bustCm: number;
  waistCm: number;
  hipCm: number;
  type: BodyType;
  section: Section;
  register: StyleRegister;
  /** 1-line style note used as the "why this match" hint */
  styleNote: string;
  thumbnailUrl: string;
  /** Bonfida .sol domain when the celeb (or their team) holds one. Marks the
   *  account as identity-verified in our trending feeds. Subset is illustrative
   *  for v0; v1 verifies on-chain via reverseLookupWallet. */
  dotsol?: string;
}

/** Lookup the .sol verification status for a celeb slug. Used by LookCard
 *  + LikenessRow to render the verified badge. */
export function celebDotSol(slug: string): string | null {
  return LIKENESS_DB.find((c) => c.slug === slug)?.dotsol ?? null;
}

// Body-type inference from CWH ratios. Heuristics drawn from standard
// fashion-industry classifications (Trinny & Susannah / Body Shape Project).
export function inferBodyType(
  chestCm: number,
  waistCm: number,
  hipCm: number
): BodyType {
  const bustHipDiff = (chestCm - hipCm) / chestCm;
  const waistToBust = waistCm / chestCm;

  if (waistToBust > 0.9) return "apple"; // little waist definition
  if (bustHipDiff < -0.05) return "pear"; // hips wider than bust
  if (bustHipDiff > 0.05 && waistToBust > 0.8) return "inverted-triangle";
  if (Math.abs(bustHipDiff) < 0.05 && waistToBust < 0.78) return "hourglass";
  return "rectangle";
}

export const BODY_TYPE_GUIDANCE: Record<BodyType, string> = {
  rectangle:
    "Lean lines. Add visual structure with belts, layered tops, defined shoulders.",
  hourglass:
    "Defined waist. Lean into wrap silhouettes, fitted high-waist, body-skimming knits.",
  pear:
    "Hips wider than bust. Balance with shoulder volume, statement tops, A-line skirts.",
  "inverted-triangle":
    "Broad shoulders. Soften the top with v-necks; add volume below with wide-leg pants.",
  apple:
    "Soft midsection. Empire waists, draped layers, structured outerwear flatter the silhouette.",
};

export const LIKENESS_DB: CelebLikeness[] = [
  // === Womens / feminine ===
  {
    name: "Zendaya",
    slug: "zendaya",
    heightCm: 179,
    bustCm: 86,
    waistCm: 66,
    hipCm: 91,
    type: "rectangle",
    section: "womens",
    register: "feminine",
    styleNote:
      "Lean rectangle build · architectural tailoring works (column gowns, sharp pantsuits).",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=400&q=70",
    dotsol: "zendaya",
  },
  {
    name: "Bella Hadid",
    slug: "bella",
    heightCm: 175,
    bustCm: 84,
    waistCm: 60,
    hipCm: 91,
    type: "hourglass",
    section: "womens",
    register: "feminine",
    styleNote:
      "Defined hourglass · sheer mesh, low-rise leather, fitted knits suit the proportions.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1542295669297-4d352b042bca?w=400&q=70",
    dotsol: "bella",
  },
  {
    name: "Hailey Bieber",
    slug: "hailey",
    heightCm: 171,
    bustCm: 84,
    waistCm: 58,
    hipCm: 86,
    type: "hourglass",
    section: "womens",
    register: "feminine",
    styleNote:
      "Petite hourglass · ice-blue silk shifts, hand-embroidered florals, single statement piece.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=400&q=70",
  },
  {
    name: "Rihanna",
    slug: "rihanna",
    heightCm: 173,
    bustCm: 91,
    waistCm: 71,
    hipCm: 99,
    type: "pear",
    section: "womens",
    register: "feminine",
    styleNote:
      "Curvy pear · embellished capes, corsetry, dramatic shoulder volume balances the hip.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=400&q=70",
    dotsol: "rihanna",
  },
  {
    name: "Margot Robbie",
    slug: "margot",
    heightCm: 168,
    bustCm: 86,
    waistCm: 61,
    hipCm: 86,
    type: "hourglass",
    section: "womens",
    register: "feminine",
    styleNote:
      "Old-Hollywood hourglass · cowl-neck slip gowns, vintage diamonds, columnar drape.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=70",
  },
  {
    name: "Kendall Jenner",
    slug: "kendall",
    heightCm: 179,
    bustCm: 86,
    waistCm: 61,
    hipCm: 89,
    type: "rectangle",
    section: "womens",
    register: "feminine",
    styleNote:
      "Tall rectangle · sheer column gowns, hand-embroidered detail, hair-slick minimalism.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1546006121-c3b54f08e7f9?w=400&q=70",
  },

  // === Mens / masculine ===
  {
    name: "Tyler, the Creator",
    slug: "tyler",
    heightCm: 181,
    bustCm: 99,
    waistCm: 83,
    hipCm: 101,
    type: "rectangle",
    section: "mens",
    register: "masculine",
    styleNote:
      "Tall rectangle · pastel three-piece suiting, contrast knits, cropped trousers.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=70",
    dotsol: "tyler",
  },
  {
    name: "A$AP Rocky",
    slug: "asap",
    heightCm: 175,
    bustCm: 96,
    waistCm: 79,
    hipCm: 94,
    type: "rectangle",
    section: "mens",
    register: "masculine",
    styleNote:
      "Mid-height rectangle · oversized overcoats, cable-knit layering, pleated wide-leg trousers.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1521146764736-56c929d59c83?w=400&q=70",
  },
  {
    name: "Timothée Chalamet",
    slug: "timothee",
    heightCm: 175,
    bustCm: 91,
    waistCm: 76,
    hipCm: 89,
    type: "rectangle",
    section: "mens",
    register: "neutral",
    styleNote:
      "Slim rectangle · ivory satin tuxedos worn open, statement brooches, gender-fluid tailoring.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=70",
  },
  {
    name: "Harry Styles",
    slug: "harry",
    heightCm: 183,
    bustCm: 97,
    waistCm: 81,
    hipCm: 94,
    type: "rectangle",
    section: "mens",
    register: "neutral",
    styleNote:
      "Tall rectangle · pearls + boas + heeled boots, embroidered jumpsuits, gender-bending.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&q=70",
  },
];

export interface LikenessMatch {
  celeb: CelebLikeness;
  score: number; // 0..1
  factors: {
    typeScore: number;
    heightScore: number;
    ratioScore: number;
    sectionScore: number;
  };
}

/**
 * Find the top-N celeb likenesses for a given twin.
 *
 * Score weights (must sum to 1):
 *   · Body type categorical match: 0.50
 *   · Bust/hip:waist ratio similarity: 0.25
 *   · Height proximity (gaussian σ=10cm): 0.15
 *   · Section alignment: 0.10
 */
export function findClosestLikenesses(
  twin: {
    heightCm: number;
    chestCm: number;
    waistCm: number;
    hipCm: number;
    section?: Section;
    styleRegister?: StyleRegister;
  },
  limit = 3
): LikenessMatch[] {
  const userType = inferBodyType(twin.chestCm, twin.waistCm, twin.hipCm);
  const userBustWaist = twin.chestCm / Math.max(1, twin.waistCm);
  const userHipWaist = twin.hipCm / Math.max(1, twin.waistCm);

  return LIKENESS_DB.map((celeb): LikenessMatch => {
    const typeScore = celeb.type === userType ? 1 : 0;

    const heightDiff = Math.abs(celeb.heightCm - twin.heightCm);
    const heightScore = Math.exp(-(heightDiff * heightDiff) / (2 * 10 * 10));

    const celebBustWaist = celeb.bustCm / celeb.waistCm;
    const celebHipWaist = celeb.hipCm / celeb.waistCm;
    const ratioDist = Math.sqrt(
      Math.pow(celebBustWaist - userBustWaist, 2) +
        Math.pow(celebHipWaist - userHipWaist, 2)
    );
    const ratioScore = Math.exp(-ratioDist * 2);

    let sectionScore = 0.5;
    if (twin.section) {
      if (twin.section === "both" || twin.section === "androgynous") {
        sectionScore = 0.8;
      } else if (celeb.section === twin.section) {
        sectionScore = 1.0;
      } else if (celeb.section === "both") {
        sectionScore = 0.7;
      } else {
        sectionScore = 0.3;
      }
    }

    const score =
      typeScore * 0.5 +
      ratioScore * 0.25 +
      heightScore * 0.15 +
      sectionScore * 0.1;

    return {
      celeb,
      score,
      factors: { typeScore, heightScore, ratioScore, sectionScore },
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
