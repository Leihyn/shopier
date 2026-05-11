import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import { getLook, bumpViews } from "@/lib/looksDb";
import { ExternalLink, Eye, BadgeCheck } from "lucide-react";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const look = getLook(slug);
  if (!look) return { title: "Look not found — Shopier" };
  return {
    title: `${look.title} — Shopier`,
    description: look.styleNotes || `${look.items.length} pieces, shoppable.`,
    openGraph: {
      title: look.title,
      description: look.styleNotes || `${look.items.length} pieces`,
      type: "article",
    },
  };
}

const TIER_PILL: Record<string, string> = {
  exact: "bg-amber-500/20 text-amber-400",
  mid: "bg-blue-500/20 text-blue-400",
  budget: "bg-green-500/20 text-green-400",
  thrifted: "bg-amber-500/20 text-amber-400",
};

export default async function LookPage({ params }: Params) {
  const { slug } = await params;
  const look = getLook(slug);
  if (!look) notFound();
  bumpViews(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: look.title,
    description: look.styleNotes,
    numberOfItems: look.items.length,
    itemListElement: look.items.map((it, idx) => ({
      "@type": "Product",
      position: idx + 1,
      name: it.name,
      ...(it.price ? { offers: { "@type": "Offer", price: it.price, priceCurrency: "USD" } } : {}),
      ...(it.url ? { url: it.url } : {}),
    })),
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:pb-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Link
          href="/looks"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All looks
        </Link>

        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight">{look.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {look.creatorHandle && look.signatureB58 ? (
            <Link
              href={`/c/${look.creatorHandle}`}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 font-medium text-foreground transition-colors hover:bg-muted/60"
              title="Verified curator signature"
            >
              <BadgeCheck size={11} />
              Curated by @{look.creatorHandle}
            </Link>
          ) : (
            <span className="rounded-full border border-dashed border-border/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider">
              Anonymous
            </span>
          )}
          {look.aesthetic && <span>{look.aesthetic}</span>}
          {look.occasion && <span>·</span>}
          {look.occasion && <span>{look.occasion}</span>}
          <span>·</span>
          <span className="flex items-center gap-1">
            <Eye size={11} />
            {look.views.toLocaleString()}
          </span>
        </div>
        {look.styleNotes && (
          <p className="mt-4 text-sm text-muted-foreground">{look.styleNotes}</p>
        )}

        {look.sourceImageBase64 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${look.sourceImageBase64}`}
              alt="Source outfit"
              className="w-full"
            />
          </div>
        )}

        <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {look.items.length} pieces
        </h2>
        <ul className="space-y-2">
          {look.items.map((item, i) => (
            <li
              key={i}
              className="rounded-xl border border-border/60 bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.category}
                    {item.color && ` · ${item.color}`}
                    {item.style && ` · ${item.style}`}
                  </p>
                  {item.fitToYou && (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      “{item.fitToYou}”
                    </p>
                  )}
                </div>
                {item.price !== undefined && item.price > 0 && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    ${item.price.toFixed(0)}
                  </span>
                )}
              </div>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.tier && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        TIER_PILL[item.tier] || "bg-muted/40"
                      }`}
                    >
                      {item.tier === "exact" ? "premium" : item.tier}
                    </span>
                  )}
                  Shop on {item.retailer || "the source"}
                  <ExternalLink size={11} />
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-xl border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm font-semibold">
            Build your own digital twin and shop looks calibrated to you.
          </p>
          <Link
            href="/agent"
            className="mt-3 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
          >
            Try Shopier
          </Link>
        </div>
      </main>
    </>
  );
}
