"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

interface LiveState {
  mode: "live" | "post-event" | "countdown" | "between-events";
  event: {
    slug: string;
    title: string;
    date: string;
    venue: string;
  };
  delta: number;
  countdown?: { title: string; date: string; secondsUntil: number };
  stats: {
    looksIndexed: number;
    activeWatchers: number;
    autoBuysFiredLastHour: number;
  };
}

/**
 * Sticky top broadcast strip — shows the active event status, watcher count,
 * and recent auto-buy throughput. Polls /api/events/live every 30s. Pages
 * mount this manually so we don't compete with the global navbar.
 *
 * Mode framing:
 *   · live          → "LIVE · MET GALA" with green pulse
 *   · post-event    → "POST · MET GALA" with amber dot, recap framing
 *   · countdown     → countdown to next tentpole
 *   · between-events → only the countdown shows
 */
export default function LiveTicker() {
  const [state, setState] = useState<LiveState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchState = () =>
      fetch("/api/events/live")
        .then((r) => r.json())
        .then((d) => !cancelled && setState(d))
        .catch(() => {
          /* swallow */
        });
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // 1s tick for the countdown re-render
  useEffect(() => {
    if (!state?.countdown) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state?.countdown]);

  if (!state) return null;

  const isLive = state.mode === "live";
  const isPost = state.mode === "post-event";
  const showsActive = isLive || isPost;

  // Compute current countdown using state.countdown.secondsUntil minus elapsed since fetch
  const cd = state.countdown;
  const cdRemaining = cd ? Math.max(0, cd.secondsUntil - tick) : 0;

  return (
    <div className="fixed inset-x-0 top-0 z-[55] flex h-7 items-center gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3 text-[11px] font-semibold backdrop-blur-md">
      {showsActive && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span
            className={
              isLive
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-400"
            }
          >
            {isLive ? "LIVE" : "POST"}
          </span>
        </span>
      )}

      {showsActive && (
        <Link
          href={`/events/${state.event.slug}`}
          className="font-display tracking-tight hover:underline"
        >
          {state.event.title}
        </Link>
      )}

      {/* On md+, surface a single high-signal stat instead of three */}
      {showsActive && state.stats.autoBuysFiredLastHour > 0 && (
        <span className="hidden font-mono text-[10px] tabular-nums text-amber-700 dark:text-amber-400 md:inline">
          · {state.stats.autoBuysFiredLastHour} auto-buy
          {state.stats.autoBuysFiredLastHour > 1 ? "s" : ""} last hr
        </span>
      )}

      {cd && (
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock size={9} />
          <span className="hidden sm:inline">{cd.title}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCountdown(cdRemaining)}
          </span>
        </span>
      )}
    </div>
  );
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
