import Link from "next/link";
import { Sparkles, Plane, TrendingUp, Vote, ArrowRight } from "lucide-react";

/**
 * Verticals row — broadens the pitch from "fashion shopping app" to "agent
 * commerce protocol with fashion as the first surface."
 *
 * Each card describes one vertical the same on-chain primitives apply to:
 *   - Trust container (spending policy)
 *   - Privacy substrate (encrypted twin, where applicable)
 *   - Real-time autonomy (session-key delegation)
 *   - Programmable trigger (watch policy)
 *
 * Fashion is shipping today — the others are credible adjacent verticals.
 * Status badges signal which is live vs roadmap. The status framing matters
 * for hackathon judges: it forces them to see this as a protocol, not an app.
 */

const VERTICALS = [
  {
    icon: Sparkles,
    name: "Fashion",
    status: "live" as const,
    trigger: "Celebrity events",
    body: "Match Met Gala looks to your twin. Settle inside spending bound. The proof of concept.",
    href: "/trending",
  },
  {
    icon: Plane,
    name: "Travel",
    status: "v2" as const,
    trigger: "Fare drops, delays",
    body: "Watch your route. Agent rebooks within bounds when fare drops below your cap or your flight is cancelled.",
    href: "/architecture",
  },
  {
    icon: TrendingUp,
    name: "DeFi yield",
    status: "v2" as const,
    trigger: "Rate moves",
    body: "Yield twin holds risk preferences. Agent routes deposits across protocols within bounds you signed once.",
    href: "/architecture",
  },
  {
    icon: Vote,
    name: "Governance",
    status: "v2" as const,
    trigger: "Proposal votes",
    body: "Voting twin holds your principles. Agent votes on aligned proposals within delegation rules you set.",
    href: "/architecture",
  },
];

export default function VerticalsRow() {
  return (
    <section className="mb-20">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            The pattern generalizes
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Fashion is the first surface.
          </h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VERTICALS.map((v) => {
          const Icon = v.icon;
          const isLive = v.status === "live";
          return (
            <Link
              key={v.name}
              href={v.href}
              className={`group flex flex-col gap-2 rounded-2xl border p-4 transition-all hover:border-foreground/30 ${
                isLive
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/60 bg-background"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon
                  size={16}
                  className={
                    isLive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }
                />
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    isLive
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {isLive && (
                    <span className="mr-1 inline-block h-1 w-1 rounded-full bg-emerald-500 align-middle" />
                  )}
                  {isLive ? "live" : "v2"}
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {v.name}
              </h3>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Trigger · {v.trigger}
              </p>
              <p className="text-[12px] leading-snug text-muted-foreground">
                {v.body}
              </p>
              <span className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-foreground transition-transform group-hover:translate-x-0.5">
                {isLive ? "See it" : "Concept"} <ArrowRight size={10} />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-5 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
        Same primitives — encrypted twin, programmable spending policy,
        session-key delegation, signed watches — apply to any vertical where
        an agent acts on someone&apos;s behalf at the speed of an event.
      </p>
    </section>
  );
}
