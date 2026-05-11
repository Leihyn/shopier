import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const groq = new Groq();

interface TwinContext {
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  shoulderCm: number;
  undertone: "Cool" | "Warm" | "Neutral";
  skinTone: number; // 1..10
  stylePrefs: string;
  favColors: string;
  // Personalization v2 — optional
  section?: "mens" | "womens" | "both" | "androgynous";
  styleRegister?: "masculine" | "neutral" | "feminine";
  climate?: "tropical" | "temperate" | "cold" | "four-season";
  ageRange?: string;
  brandsLove?: string;
  brandsAvoid?: string;
  hardFilters?: string[];
}

function buildPrompt(twin: TwinContext | null): string {
  const twinSection = twin
    ? `\n\nThe user has a known body, palette, and shopping context — calibrate every piece of commentary to them, not to the person in the photo:\n` +
      `- Height: ${twin.heightCm} cm, Weight: ${twin.weightKg} kg\n` +
      `- Chest: ${twin.chestCm}, Waist: ${twin.waistCm}, Hip: ${twin.hipCm}, Inseam: ${twin.inseamCm}, Shoulder: ${twin.shoulderCm} (cm)\n` +
      `- Undertone: ${twin.undertone}, Skin tone: ${twin.skinTone}/10\n` +
      `- Shops in: ${twin.section ?? "both"} (${
        twin.section === "mens"
          ? "describe items as men's pieces; use trousers, button-downs, etc."
          : twin.section === "womens"
          ? "describe items as women's pieces; use blouses, dresses, skirts where relevant"
          : "items can be from either men's or women's sections"
      })\n` +
      `- Style register: ${twin.styleRegister ?? "neutral"} (${
        twin.styleRegister === "masculine"
          ? "use clean tailored language: 'sharp shoulder line', 'crisp break', 'structured'"
          : twin.styleRegister === "feminine"
          ? "use softer drape language: 'gentle line', 'fluid silhouette', 'softness at the waist'"
          : "neutral fashion-illustration language"
      })\n` +
      `- Climate: ${twin.climate ?? "four-season"}${
        twin.climate === "tropical"
          ? " (skip heavy outerwear and wool; lean into breathable fabrics)"
          : twin.climate === "cold"
          ? " (lean into layering and insulation; flag pieces that won't survive winter)"
          : ""
      }\n` +
      `- Age range: ${twin.ageRange ?? "decline"}\n` +
      `- Style preferences: ${twin.stylePrefs}\n` +
      `- Favorite colors: ${twin.favColors}\n` +
      (twin.brandsLove ? `- Brands they love: ${twin.brandsLove}\n` : "") +
      (twin.brandsAvoid ? `- Brands they avoid: ${twin.brandsAvoid}\n` : "") +
      (twin.hardFilters && twin.hardFilters.length
        ? `- Hard filters (NEVER suggest items that violate these): ${twin.hardFilters.join(", ")}\n`
        : "") +
      `\nFor "fitToYou" on each item, write 1 short sentence comparing how the piece falls on the person in the photo vs how it would land on the user (proportions, length, palette). Be concrete. Use the user's style register for tone. Example for masculine register: "the celeb's blazer falls mid-thigh on her 5'10 frame; on your 5'7 it lands lower-thigh — pair with high-rise trousers to keep the line clean."`
    : `\n\nNo digital twin set up. Skip the per-item "fitToYou" commentary; leave it as an empty string.`;

  return `You are a fashion expert. Look at this photo and identify EVERY piece of clothing and accessory the person is wearing.

Go head to toe:
- Head: hat, cap, sunglasses, glasses, headband?
- Neck: necklace, chain, scarf, tie?
- Top: what shirt/top? Color, fit, material?
- Layer: jacket, blazer, coat, hoodie over the top?
- Bottom: pants, jeans, shorts, skirt? Color, fit?
- Waist: belt?
- Wrist/hands: watch, bracelet, rings, bag?
- Feet: what shoes? Color, style, brand if visible?

Be VERY specific. Say "Light Wash Relaxed Fit Denim Jeans" not "jeans". Say "White Leather Low-Top Sneakers" not "white shoes".${twinSection}

Return ONLY this JSON, nothing else:
{
  "items": [
    {
      "name": "Very specific name with color (e.g. 'Black Oversized Graphic Hoodie')",
      "category": "top|bottom|shoes|outerwear|accessory|other",
      "color": "specific color like 'navy blue' or 'cream'",
      "style": "fit descriptors like 'oversized' or 'slim fit' or 'cropped'",
      "estimatedPriceRange": "budget|mid|premium|luxury",
      "fitToYou": "1 sentence calibrated to the user's twin, or empty string if no twin"
    }
  ],
  "styleNotes": "1-2 sentences about the overall vibe, calibrated to the user's palette and prefs when twin is set",
  "occasion": "what occasion this works for",
  "overallAesthetic": "2-3 word style label like 'minimalist streetwear'"
}`;
}

async function tryGemini(imageBase64: string, twin: TwinContext | null): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent([
    buildPrompt(twin),
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
  ]);
  return result.response.text();
}

async function tryGroq(imageBase64: string, twin: TwinContext | null): Promise<string> {
  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

  // Step 1: Vision model describes the outfit in plain text
  const visionResponse = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    max_tokens: 1000,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          {
            type: "text",
            text: `Describe in detail every piece of clothing and accessory the person in this photo is wearing. Go from head to toe. Be extremely specific about colors, fits, materials and styles. Say "relaxed fit light wash blue denim jeans" not "jeans". Say "white leather low-top sneakers with chunky sole" not "white shoes".`,
          },
        ],
      },
    ],
  });

  const rawDescription = visionResponse.choices[0]?.message?.content || "";

  // Step 2: Structure the description into JSON using the stronger text model
  const structureResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: buildPrompt(twin),
      },
      {
        role: "user",
        content: `Extract every item from this outfit description:\n\n${rawDescription}`,
      },
    ],
  });

  return structureResponse.choices[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageUrl, twin } = await req.json();

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // If imageUrl, fetch and convert to base64
    let base64Data = imageBase64;
    if (!base64Data && imageUrl) {
      const imgResponse = await fetch(imageUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      base64Data = Buffer.from(imgBuffer).toString("base64");
    }

    const twinCtx: TwinContext | null =
      twin && typeof twin === "object" && typeof twin.heightCm === "number"
        ? (twin as TwinContext)
        : null;

    let text = "";
    let provider = "gemini";

    // Try Gemini first (better vision), fall back to Groq
    try {
      text = await tryGemini(base64Data, twinCtx);
    } catch (geminiError) {
      console.log("Gemini failed, falling back to Groq:", (geminiError as Error).message);
      provider = "groq";
      try {
        text = await tryGroq(base64Data, twinCtx);
      } catch (groqError) {
        console.error("Both Gemini and Groq failed");
        console.error("Gemini error:", (geminiError as Error).message);
        console.error("Groq error:", (groqError as Error).message);
        return NextResponse.json(
          { error: `Vision API failed: ${(groqError as Error).message}` },
          { status: 500 }
        );
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to parse outfit — try a clearer photo" },
        { status: 500 }
      );
    }

    const breakdown = JSON.parse(jsonMatch[0]);

    if (!breakdown.items || breakdown.items.length === 0) {
      return NextResponse.json(
        { error: "Couldn't identify clothing items — try a photo with a person wearing a visible outfit" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      breakdown,
      provider,
      apiCost: provider === "gemini" ? "$0.003" : "$0.005",
      paidVia: "x402 on Stellar",
    });
  } catch (error) {
    console.error("Decompose error:", error);
    return NextResponse.json(
      { error: `Analysis failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
