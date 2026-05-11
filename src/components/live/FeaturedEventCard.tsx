"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ALL_EVENTS } from "@/lib/eventsData";
import { Clock, Users, Zap, ArrowRight } from "lucide-react";

/**
 * Featured event card — client-rendered hero on the home page.
 *
 * Resolves the active event (most-recent within ±14d, falling back to
 * nearest), then renders a poster-style card with hero image, mode badge
 * (LIVE / POST / COUNTDOWN), live stats, and a CTA.
 *
 * Client-rendered specifically because the relative-time string ("6d 3h
 * ago") is time-sensitive and would drift between SSR and hydration. We
 * mount with a stable "now" computed on first render, then update via a
 * 60s tick so the badge stays fresh without re-renders churning.
 */

const FLOOR_WATCHERS = 24;

export default function FeaturedEventCard() {
  // Initialize state on the client only; SSR renders a placeholder until
  // mount, then the real card swaps in. Avoids hydration mismatch entirely.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    // SSR + first render placeholder. Same dimensions as the real card so
    // page layout doesn't shift when the client mounts.
    return (
      <div className="aspect-[5/2] w-full animate-pulse rounded-3xl border border-border/40 bg-muted/10" />
    );
  }
  const nowSec = Math.floor(now / 1000);

  // Pick the most recent or upcoming event within ±14 days
  let active = ALL_EVENTS[0];
  let activeAbsDelta = Infinity;
  for (const ev of ALL_EVENTS) {
    const evSec = Math.floor(new Date(ev.date).getTime() / 1000);
    const delta = Math.abs(nowSec - evSec);
    if (delta < activeAbsDelta) {
      activeAbsDelta = delta;
      active = ev;
    }
  }
  const evSec = Math.floor(new Date(active.date).getTime() / 1000);
  const delta = nowSec - evSec; // +ve = past, -ve = future
  const mode: "live" | "post" | "countdown" =
    Math.abs(delta) < 6 * 3600
      ? "live"
      : delta > 0
      ? "post"
      : "countdown";

  const modeLabel =
    mode === "live"
      ? "LIVE NOW"
      : mode === "post"
      ? `POST · ${formatRelative(delta, "ago")}`
      : `IN ${formatRelative(-delta, "until")}`;

  return (
    <Link
      href={`/events/${active.slug}`}
      className="group relative block overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-rose-500/5 transition-all hover:border-amber-500/50 hover:shadow-lg"
    >
      {/* Hero image */}
      <div
        className="aspect-[5/2] w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.02]"
        style={{ backgroundImage: `url(${active.heroImage})` }}
      />

      {/* Top-left badge */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
        {mode === "live" && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        )}
        {mode === "post" && (
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        )}
        {mode === "countdown" && <Clock size={10} />}
        <span
          className={
            mode === "live"
              ? "text-emerald-700 dark:text-emerald-400"
              : mode === "post"
              ? "text-amber-700 dark:text-amber-400"
              : "text-foreground"
          }
        >
          {modeLabel}
        </span>
      </div>

      {/* Body — trimmed: title + 1-line description + 1 stat + CTA */}
      <div className="p-6">
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {active.title}
        </h2>
        <p className="mt-2 line-clamp-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {active.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-3 font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-amber-500" />
              <span className="font-semibold tabular-nums text-foreground">
                {active.looks.length}
              </span>{" "}
              looks
            </span>
            <span className="flex items-center gap-1">
              <Users size={10} className="text-emerald-600" />
              <span className="font-semibold tabular-nums text-foreground">
                {FLOOR_WATCHERS}+
              </span>{" "}
              watching
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-foreground transition-transform group-hover:translate-x-1">
            See looks <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatRelative(seconds: number, suffix: "ago" | "until"): string {
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${suffix}`;
  if (hours > 0) return `${hours}h ${mins}m ${suffix}`;
  return `${mins}m ${suffix}`;
}
