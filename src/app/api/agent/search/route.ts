import { NextRequest, NextResponse } from "next/server";
import { searchGoogleShopping } from "@/lib/googleShopping";

export async function POST(req: NextRequest) {
  try {
    const { query, category } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "No query" }, { status: 400 });
    }

    const searchQuery = category
      ? `${query} ${category} clothing`
      : query;

    const products = await searchGoogleShopping(searchQuery, 5);

    return NextResponse.json({
      products,
      query: searchQuery,
      googleShoppingUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
        searchQuery
      )}`,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
