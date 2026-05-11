import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import LookCard from "@/components/watches/LookCard";
import AutoBuyBanner from "@/components/watches/AutoBuyBanner";
import EventWatchAllButton from "@/components/watches/EventWatchAllButton";
import ActivityRail from "@/components/live/ActivityRail";
import { EVENTS_MAP } from "@/lib/eventsData";
import { Calendar, MapPin, Clock } from "lucide-react";

/**
 * Event status badge logic — same shape as /api/events/live but local to
 * the page render (server component runs once per request and we don't need
 * the polling).
 */
function eventStatus(eventDate: string): {
  mode: "live" | "post" | "countdown";
  label: string;
  tone: "emerald" | "amber" | "neutral";
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const evSec = Math.floor(new Date(eventDate).getTime() / 1000);
  const delta = nowSec - evSec;
  if (Math.abs(delta) < 6 * 3600) {
    return { mode: "live", label: "LIVE NOW", tone: "emerald" };
  }
  if (delta > 0) {
    const days = Math.floor(delta / 86400);
    return {
      mode: "post",
      label: days === 0 ? "POST · today" : `POST · ${days}d ago`,
      tone: "amber",
    };
  }
  const absDelta = -delta;
  const days = Math.floor(absDelta / 86400);
  const hours = Math.floor((absDelta % 86400) / 3600);
  return {
    mode: "countdown",
    label: days > 0 ? `IN ${days}d ${hours}h` : `IN ${hours}h`,
    tone: "neutral",
  };
}

/**
 * Curated event page — Grammys, Oscars, Met Gala 2026.
 *
 * Server-rendered with the hand-curated look list, but the watch toggle and
 * auto-buy banner are client-side islands that interact with the connected
 * wallet. The "Watch all 8 celebs" button lets the user subscribe to every
 * named celeb in this event in a single config flow.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(EVENTS_MAP).map((event) => ({ event }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const { event } = await params;
  const ev = EVENTS_MAP[event];
  if (!ev) return { title: "Event · Shopier" };
  return {
    title: `${ev.title} — Shop the looks · Shopier`,
    description: ev.description,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const { event } = await params;
  const ev = EVENTS_MAP[event];
  if (!ev) notFound();

  const celebList = Array.from(
    new Map(ev.looks.map((l) => [l.celebSlug, l.celeb])).entries()
  ).map(([slug, celeb]) => ({ slug, celeb }));

  const status = eventStatus(ev.date);
  const toneClasses =
    status.tone === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status.tone === "amber"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-border bg-muted/30 text-muted-foreground";

  return (
    <>
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 pt-24 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] sm:pb-12">
        <div>
        {/* Hero */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-muted/20 via-background to-muted/30">
          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                {/* Live status badge */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${toneClasses}`}
                >
                  {status.mode === "live" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {status.mode === "post" && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                  {status.mode === "countdown" && <Clock size={9} />}
                  <span>{status.label}</span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Curated event</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {ev.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {ev.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(ev.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {ev.venue}
                </span>
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                  {ev.looks.length} looks indexed
                </span>
              </div>
            </div>
            {/* Watch ALL button */}
            <EventWatchAllButton
              eventSlug={ev.slug}
              eventTitle={ev.title}
              celebs={celebList}
            />
          </div>
        </section>

        {/* Look grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ev.looks.map((look) => (
            <LookCard key={look.id} look={look} demoFire />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-border/40 bg-muted/10 p-5 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">How this works.</strong> Each look
          is a curated breakdown — we never host the celebrity image, only link
          to the journalism. Clicking "Buy" runs the agent against{" "}
          <a className="underline" href="/twin">
            your twin
          </a>{" "}
          and your{" "}
          <a className="underline" href="/agent/wallet">
            spending policy
          </a>
          , then settles in USDC under bounds you've signed. Watch a celeb to
          have the agent surface (and optionally auto-buy) future looks within
          your cap.
        </div>
        </div>
        <ActivityRail className="lg:sticky lg:top-24 lg:self-start" />
      </main>
      {/* Floating banner shows pending auto-buys + receipts */}
      <AutoBuyBanner />
    </>
  );
}
