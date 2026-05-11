import type { MetadataRoute } from "next";
import { listRecentLooks } from "@/lib/looksDb";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://shopier.app";
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/agent`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/twin`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/stylists`, changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/looks`, changeFrequency: "hourly", priority: 0.9 },
  ];

  const looks = listRecentLooks(1000);
  const lookEntries: MetadataRoute.Sitemap = looks.map((l) => ({
    url: `${baseUrl}/looks/${l.slug}`,
    lastModified: new Date(l.createdAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...lookEntries];
}
