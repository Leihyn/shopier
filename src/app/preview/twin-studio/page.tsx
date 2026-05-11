"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { Undertone } from "@/lib/solana";
import { allLooks } from "@/lib/eventsData";

const TwinModel3D = dynamic(() => import("@/components/twin/TwinModel3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={20} />
    </div>
  ),
});

/**
 * OPTION 2 — 3D twin studio.
 *
 * The bet: visual differentiation. The parametric 3D twin (already built)
 * becomes the centerpiece of the entire app. Items render onto the twin in
 * real-time as the agent matches them. Spending bound = orbital ring.
 */
export default function TwinStudioPreview() {
  const looks = allLooks().slice(0, 4);
  const twin = {
    heightCm: 175,
    weightKg: 70,
    chestCm: 95,
    waistCm: 80,
    hipCm: 95,
    inseamCm: 80,
    shoulderCm: 45,
    undertone: Undertone.Neutral,
    skinTone: 5,
  };

  return (
    <main className="min-h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/preview"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={11} /> back
            </Link>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Preview 2 of 5
            </span>
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight">Shopier</h1>
          <span className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
            32pS..gEZa
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_400px]">
        {/* LEFT — feed of looks that "try on" the twin */}
        <div>
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Drop a screenshot or browse trending
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Try on culture.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Each match renders onto your twin in real time. Items orbit
              your figure until you commit. Spending bound depletes
              visibly as you settle.
            </p>
          </div>

          <div className="space-y-3">
            {looks.map((look, i) => (
              <div
                key={look.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background p-3 transition-colors hover:bg-muted/20"
              >
                <div
                  className="aspect-square w-20 rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${look.thumbnailUrl})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {look.celeb} · {look.event}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {look.styleSummary}
                  </p>
                  <p className="mt-1 font-mono text-xs tabular-nums">
                    ${look.totalUsdBudget}
                  </p>
                </div>
                <button
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    i === 0
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "border border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {i === 0 ? "● Trying on" : "Try on twin →"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — persistent 3D twin studio */}
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-background via-emerald-500/5 to-amber-500/5">
            <div className="aspect-[3/4] w-full">
              <TwinModel3D twin={twin} />
            </div>

            {/* Trying-on indicator */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-700 backdrop-blur dark:text-amber-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              Trying on Zendaya · Grammys
            </div>

            {/* Item label tag — pointing at the figure */}
            <div className="absolute right-3 top-1/3 rounded-lg border border-border/70 bg-background/85 px-2.5 py-1.5 text-[10px] backdrop-blur">
              <p className="font-mono text-muted-foreground">
                metallic column gown
              </p>
              <p className="font-mono font-semibold tabular-nums">$220 · budget tier</p>
            </div>

            {/* Bottom orbital bound visualization */}
            <div className="absolute inset-x-0 bottom-0 border-t border-border/40 bg-background/85 p-4 backdrop-blur">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Spending bound · orbital
              </p>
              <div className="relative">
                {/* Ring SVG */}
                <svg
                  viewBox="0 0 200 36"
                  className="w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <ellipse
                    cx="100"
                    cy="18"
                    rx="90"
                    ry="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeOpacity="0.2"
                  />
                  <ellipse
                    cx="100"
                    cy="18"
                    rx="90"
                    ry="14"
                    fill="none"
                    stroke="rgb(16,185,129)"
                    strokeWidth="2"
                    strokeDasharray="380 100"
                    strokeDashoffset="80"
                    strokeLinecap="round"
                  />
                  <text
                    x="100"
                    y="22"
                    textAnchor="middle"
                    className="fill-foreground font-mono text-[10px] font-bold tabular-nums"
                  >
                    $215 / $1,000 today
                  </text>
                </svg>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>Tone 5/10</span>
                <span>175cm · 70kg</span>
                <span>95/80/95</span>
              </div>
            </div>
          </div>

          {/* Watches as ghosted celeb silhouettes orbiting */}
          <div className="mt-3 rounded-2xl border border-border/60 bg-background p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Orbiting · 4 active watches
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Zendaya", "Bella", "Rihanna", "Tyler"].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  ◐ {c}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
