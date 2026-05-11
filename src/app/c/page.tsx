import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { listCreators } from "@/lib/creatorsDb";
import { Plus, Users } from "lucide-react";

export const metadata = {
  title: "Creators — Shopier",
  description: "Creators on Shopier — referral hosts, stylist subscriptions, signed look curators.",
};

export default function CreatorsListing() {
  const creators = listCreators(100);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:pb-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Creators</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Every creator hosts a referral link, optionally offers a stylist
              subscription, and signs the looks they curate. Pick one whose
              taste you trust.
            </p>
          </div>
          <Link
            href="/c/become"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            <Plus size={14} /> Become one
          </Link>
        </div>

        {creators.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
            <Users size={28} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-semibold">No creators yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first. Connect your wallet and create your profile.
            </p>
            <Link
              href="/c/become"
              className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Create a profile
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {creators.map((c) => {
              const cutPct = (c.cutBps / 100).toFixed(1);
              return (
                <Link
                  key={c.handle}
                  href={`/c/${c.handle}`}
                  className="group rounded-xl border border-border/60 bg-background p-5 transition-colors hover:border-foreground/30 hover:bg-muted/20"
                >
                  <div className="flex items-baseline gap-2">
                    <p className="text-base font-semibold">@{c.handle}</p>
                    {c.dotsolName && (
                      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {c.dotsolName}.sol
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.bio}</p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Referral cut · {cutPct}%
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
