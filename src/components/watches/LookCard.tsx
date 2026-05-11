"use client";

import { useState } from "react";
import { ExternalLink, Sparkles, Loader2, Play, MapPin } from "lucide-react";
import WatchToggle from "./WatchToggle";
import type { CelebLook } from "@/lib/eventsData";
import { useBridgeMode } from "@/lib/useBridgeMode";
import { celebDotSol } from "@/lib/likenessDb";
import { cn } from "@/lib/utils";

// Approximate USD → NGN conversion rate. v1: pull from a real FX feed (e.g.,
// Raenest's quote endpoint). For demo, locked to a recent spot rate.
const USD_TO_NGN = 1530;

interface Props {
  look: CelebLook;
  /** When true, the card shows a small "Fire watch" demo button next to the source link.
      Used only on /trending in dev / demo mode — calls /api/watches/fire. */
  demoFire?: boolean;
}

/**
 * LookCard — the trending feed unit.
 *
 * Shows: thumbnail (hot-linked to source), celeb name, event, style summary,
 * itemized breakdown with three-tier pricing, source attribution,
 * watch-celeb toggle, and (in demo mode) a fire-the-watch button.
 *
 * The thumbnail loads with `referrerPolicy="no-referrer"` so we don't expose
 * traffic patterns to the source CDN. We never host the image.
 */
export default function LookCard({ look, demoFire = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState<string | null>(null);
  const { mode: bridgeMode } = useBridgeMode();
  const isLagos = bridgeMode === "lagos";
  const dotsol = celebDotSol(look.celebSlug);

  async function fireWatch() {
    setFiring(true);
    setFireResult(null);
    try {
      const res = await fetch("/api/watches/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebSlug: look.celebSlug, lookId: look.id }),
      });
      const data = await res.json();
      setFireResult(
        data.matched > 0
          ? `Matched ${data.matched} watcher${data.matched > 1 ? "s" : ""} — check banner`
          : data.message || "No active watches"
      );
    } finally {
      setFiring(false);
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background transition-shadow hover:shadow-lg">
      {/* Thumbnail with overlay watch toggle */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={look.thumbnailUrl}
          alt={`${look.celeb} at ${look.event}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        {/* Top scrim with celeb + event */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/15 to-transparent p-3 pb-8">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-white">
              <div className="flex items-center gap-1.5 text-sm font-semibold drop-shadow">
                {look.celeb}
                {dotsol && (
                  <span
                    className="rounded bg-emerald-500/30 px-1 py-0.5 font-mono text-[8px] font-semibold text-emerald-100"
                    title={`${dotsol}.sol · SNS verified identity`}
                  >
                    ✓ .sol
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                {look.event} · {look.occasion}
              </div>
            </div>
            <WatchToggle
              celebSlug={look.celebSlug}
              celebName={look.celeb}
              compact
              className="shrink-0"
            />
          </div>
        </div>
        {/* Bottom price strip */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-8">
          <div className="flex items-end justify-between gap-2 text-white">
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              from
              <span className="ml-1 text-base font-bold tracking-tight tabular-nums">
                ${look.totalUsdBudget}
              </span>
              {isLagos && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/30 px-1 py-0.5 font-mono text-[9px] font-semibold text-emerald-100">
                  <MapPin size={8} />
                  ≈ ₦
                  {(look.totalUsdBudget * USD_TO_NGN).toLocaleString("en-NG", {
                    maximumFractionDigits: 0,
                  })}
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] opacity-70">
              {look.section} · {look.register}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {look.styleSummary}
        </p>

        {/* Three-tier pricing */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <TierPill label="Budget" amount={look.totalUsdBudget} active />
          <TierPill label="Mid" amount={look.totalUsdMid} />
          <TierPill label="Premium" amount={look.totalUsdPremium} />
        </div>

        {/* Items toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-muted/40"
        >
          <span className="font-semibold text-foreground">
            {look.items.length} component pieces
          </span>
          <span className="text-muted-foreground">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <ul className="mt-2 space-y-1.5 rounded-lg bg-muted/30 p-3 text-[11px]">
            {look.items.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 leading-snug"
              >
                <span className="truncate text-foreground">{it.name}</span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  ${it.budgetUsd} · ${it.midUsd} · ${it.premiumUsd}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <a
            href={look.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Sparkles size={11} /> {look.sourceName}
            <ExternalLink size={10} />
          </a>

          {demoFire && (
            <button
              onClick={fireWatch}
              disabled={firing}
              className={cn(
                "flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-40 dark:text-amber-400"
              )}
              title="Demo: simulate the cron firing this look against active watches"
            >
              {firing ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              {fireResult ? "Fired" : "Fire watch"}
            </button>
          )}
        </div>
        {fireResult && (
          <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
            {fireResult}
          </div>
        )}
      </div>
    </article>
  );
}

function TierPill({
  label,
  amount,
  active = false,
}: {
  label: string;
  amount: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center",
        active
          ? "border-foreground/40 bg-muted/40"
          : "border-border bg-background"
      )}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-bold tabular-nums">${amount}</span>
    </div>
  );
}
