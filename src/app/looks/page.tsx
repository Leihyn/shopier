import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { listRecentLooks } from "@/lib/looksDb";
import { Eye, BadgeCheck } from "lucide-react";

export const metadata = {
  title: "Looks — Shopier",
  description: "Real outfits, decomposed. Twin-calibrated commentary, shoppable links, USDC settlement.",
};

export default function LooksPage() {
  const looks = listRecentLooks(48);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:pb-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Looks</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Outfits people decomposed and published. Click any look to see the
            breakdown, shoppable items, and twin-calibrated commentary.
          </p>
        </div>

        {looks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
            <p className="text-sm font-semibold">No public looks yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first. Decompose an outfit and hit Publish.
            </p>
            <Link
              href="/agent"
              className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Try the agent
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((look) => (
              <Link
                key={look.slug}
                href={`/looks/${look.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background transition-colors hover:border-foreground/30"
              >
                {look.sourceImageBase64 ? (
                  <div className="aspect-[3/4] overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${look.sourceImageBase64}`}
                      alt={look.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center bg-muted/30 text-xs text-muted-foreground">
                    No preview
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-medium">{look.title}</p>
                  {look.creatorHandle && look.signatureB58 ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground">
                      <BadgeCheck size={11} />@{look.creatorHandle}
                    </p>
                  ) : look.aesthetic ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {look.aesthetic}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
                    <span>{look.items.length} pieces</span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} />
                      {look.views}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
