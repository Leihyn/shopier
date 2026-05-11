"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/layout/Navbar";
import LookCard from "@/components/watches/LookCard";
import AutoBuyBanner from "@/components/watches/AutoBuyBanner";
import ActivityRail from "@/components/live/ActivityRail";
import { useTwin } from "@/lib/useTwin";
import {
  ALL_EVENTS,
  allLooks,
  filterAndRank,
  type CelebLook,
} from "@/lib/eventsData";
import { TrendingUp, Filter, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /trending — feed across all events, ranked + filtered to twin.
 *
 * Filters:
 *   · Event tag (Grammys / Oscars / Met Gala / All)
 *   · Section pill (auto-applied from twin if available)
 *   · Max budget slider (default $1000, capped at $5000)
 *
 * The page uses the connected wallet's twin to default-personalize, but every
 * filter is overridable. Twin is the *suggestion*, not the cage.
 */

type EventFilter = "all" | "grammys-2026" | "oscars-2026" | "met-gala-2026";

export default function TrendingPage() {
  const wallet = useWallet();
  const searchParams = useSearchParams();
  const { twin } = useTwin();
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [budgetCap, setBudgetCap] = useState<number>(1500);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [matchTwin, setMatchTwin] = useState<boolean>(true);
  const [celebFilter, setCelebFilter] = useState<string | null>(null);

  // Honor ?celeb=<slug> query — used by /twin's likeness matches as the
  // entry into a celeb-specific view of trending.
  useEffect(() => {
    const c = searchParams.get("celeb");
    if (c) setCelebFilter(c);
  }, [searchParams]);

  const ranked = useMemo<CelebLook[]>(() => {
    let pool = allLooks();
    if (eventFilter !== "all") {
      pool = pool.filter((l) => l.eventSlug === eventFilter);
    }
    if (celebFilter) {
      pool = pool.filter((l) => l.celebSlug === celebFilter);
    }
    return filterAndRank(pool, {
      maxBudgetUsd: budgetCap,
      section:
        (sectionFilter as "mens" | "womens" | "both" | "androgynous" | null) ??
        (matchTwin && twin ? twin.section : undefined) ??
        undefined,
      register: matchTwin && twin ? twin.styleRegister : undefined,
    });
  }, [eventFilter, budgetCap, sectionFilter, matchTwin, twin, celebFilter]);

  return (
    <>
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 pt-24 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] sm:pb-12">
        <div>
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <TrendingUp size={10} className="text-amber-500" />
              Trending now
            </div>
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.02em] sm:text-5xl">
              What culture&apos;s wearing.
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles size={11} className="text-amber-500" />
            {ranked.length} looks
            {wallet.publicKey && twin && matchTwin && (
              <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                twin-matched
              </span>
            )}
          </div>
        </header>

        {/* Filters */}
        <section className="mb-6 rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter size={11} />
            Filters
          </div>

          {/* Event chips */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip
              active={eventFilter === "all"}
              onClick={() => setEventFilter("all")}
            >
              All events
            </Chip>
            {ALL_EVENTS.map((e) => (
              <Chip
                key={e.slug}
                active={eventFilter === e.slug}
                onClick={() => setEventFilter(e.slug as EventFilter)}
              >
                {e.title}
              </Chip>
            ))}
          </div>

          {/* Celeb filter — appears when ?celeb= is set or pill is active */}
          {celebFilter && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Celeb
              </span>
              <button
                onClick={() => setCelebFilter(null)}
                className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
                title="Clear celeb filter"
              >
                <span className="capitalize">{celebFilter}</span>
                <span className="text-base leading-none">×</span>
              </button>
            </div>
          )}

          {/* Section + match-twin toggle */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Section
            </span>
            {(["all", "mens", "womens", "androgynous"] as const).map((s) => (
              <Chip
                key={s}
                active={
                  sectionFilter === (s === "all" ? null : s) &&
                  (s === "all" ? sectionFilter === null : true)
                }
                onClick={() =>
                  setSectionFilter(s === "all" ? null : s)
                }
                size="sm"
              >
                {s === "all" ? "All" : s === "mens" ? "Men's" : s === "womens" ? "Women's" : "Androgynous"}
              </Chip>
            ))}
            {twin && (
              <button
                onClick={() => setMatchTwin((m) => !m)}
                className={cn(
                  "ml-auto rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  matchTwin
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                {matchTwin ? "Twin-matched ✓" : "Match my twin"}
              </button>
            )}
          </div>

          {/* Budget cap slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Max budget per look
              </span>
              <span className="font-mono text-[11px] tabular-nums">
                ${budgetCap.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={budgetCap}
              onChange={(e) => setBudgetCap(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>
        </section>

        {/* Grid — featured hero card spans 2x2 on lg+; remaining cards fill */}
        {ranked.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-10 text-center text-sm text-muted-foreground">
            No looks match those filters. Try widening the budget or section.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ranked.map((look, idx) => (
              <div
                key={look.id}
                className={cn(
                  // Top-ranked look spans 2 cols + 2 rows on lg breakpoint
                  // for magazine-feed feel — the rest are uniform.
                  idx === 0 && "lg:col-span-2 lg:row-span-2",
                  // Subtle staggered entrance
                  idx === 0
                    ? "fade-up"
                    : idx < 4
                    ? `fade-up-delay-${idx}`
                    : "fade-up-delay-3"
                )}
              >
                <LookCard look={look} demoFire />
              </div>
            ))}
          </div>
        )}
        </div>
        <ActivityRail className="lg:sticky lg:top-24 lg:self-start" />
      </main>
      <AutoBuyBanner />
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
  size = "md",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full transition-colors",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs",
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}
