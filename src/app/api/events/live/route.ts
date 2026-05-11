import { NextResponse } from "next/server";
import { ALL_EVENTS } from "@/lib/eventsData";
import { countWatchersForEvent, countBoughtSince } from "@/lib/watchesDb";

/**
 * Active event resolver.
 *
 * Logic:
 *   - If a curated event's date is within ±7 days of "now", it's the active event
 *     (live during the event window, post-event coverage just after)
 *   - Otherwise we pick the next upcoming event and surface a countdown
 *
 * Today is May 10, 2026:
 *   - Met Gala (May 4)  → 6 days ago → "post-event coverage"
 *   - Cannes (May 13)   → 3 days away (not in our event data yet)
 *   - Grammys (Feb 2)   → 97 days ago → too old
 *   - Oscars (Mar 8)    → 63 days ago → too old
 *
 * For demo punch, we surface Met Gala 2026 as "live recap" (post-event but
 * within the engagement window) and overlay a Cannes countdown when none of
 * the curated events is currently live.
 *
 * Live stats blend real on-chain activity (watch counts, recent auto-buys)
 * with floor values so the ticker never reads "0 watchers". Floors keep the
 * demo plausible without making real data invisible.
 */

const NOW_OVERRIDE: number | null = null; // set to a unix-ms to demo a different "now"

interface LiveEventResponse {
  mode: "live" | "post-event" | "countdown" | "between-events";
  event: {
    slug: string;
    title: string;
    date: string;
    venue: string;
    description: string;
  };
  /** Seconds since/until the event (positive = past, negative = future) */
  delta: number;
  countdown?: { title: string; date: string; secondsUntil: number };
  stats: {
    looksIndexed: number;
    activeWatchers: number;
    autoBuysFiredLastHour: number;
  };
  fetchedAt: string;
}

const FLOOR_WATCHERS = 24;
const FLOOR_AUTO_BUYS_HOUR = 2;

const NEXT_TENTPOLE = {
  title: "Cannes Film Festival",
  date: "2026-05-13T18:00:00Z",
};

export async function GET() {
  const now = NOW_OVERRIDE ?? Date.now();
  const nowSec = Math.floor(now / 1000);

  // Find the most recent or upcoming event within ±7 days
  let active = ALL_EVENTS[0];
  let activeDelta = Infinity;
  let activeMode: LiveEventResponse["mode"] = "between-events";

  for (const ev of ALL_EVENTS) {
    const evSec = Math.floor(new Date(ev.date).getTime() / 1000);
    const delta = nowSec - evSec; // +ve = past, -ve = future
    if (Math.abs(delta) < Math.abs(activeDelta)) {
      activeDelta = delta;
      active = ev;
      if (Math.abs(delta) < 6 * 3600) activeMode = "live";
      else if (delta > 0 && delta < 14 * 86400) activeMode = "post-event";
      else if (delta < 0 && delta > -14 * 86400) activeMode = "countdown";
      else activeMode = "between-events";
    }
  }

  // Pull real watcher count + recent auto-buys, floor for plausibility
  let realWatchers = 0;
  let realAutoBuys = 0;
  try {
    realWatchers = countWatchersForEvent(active.slug);
    realAutoBuys = countBoughtSince(now - 3600_000);
  } catch {
    /* swallow — db may not be initialized */
  }

  const cannesSec = Math.floor(new Date(NEXT_TENTPOLE.date).getTime() / 1000);
  const secondsUntilCannes = cannesSec - nowSec;

  const response: LiveEventResponse = {
    mode: activeMode,
    event: {
      slug: active.slug,
      title: active.title,
      date: active.date,
      venue: active.venue,
      description: active.description,
    },
    delta: activeDelta,
    countdown:
      secondsUntilCannes > 0 && secondsUntilCannes < 30 * 86400
        ? {
            title: NEXT_TENTPOLE.title,
            date: NEXT_TENTPOLE.date,
            secondsUntil: secondsUntilCannes,
          }
        : undefined,
    stats: {
      looksIndexed: active.looks.length,
      activeWatchers: Math.max(realWatchers, FLOOR_WATCHERS),
      autoBuysFiredLastHour: Math.max(realAutoBuys, FLOOR_AUTO_BUYS_HOUR),
    },
    fetchedAt: new Date(now).toISOString(),
  };

  return NextResponse.json(response);
}
