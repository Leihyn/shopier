import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import ActivityRail from "@/components/live/ActivityRail";
import FeaturedEventCard from "@/components/live/FeaturedEventCard";
import HeroCtas from "@/components/live/HeroCtas";
import VerticalsRow from "@/components/live/VerticalsRow";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 pt-24 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] sm:pb-12">
        <div>
          {/* Hero — declarative protocol thesis. Demo lives below. */}
          <section className="mb-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Programmable agent commerce on Solana
            </p>
            <h1 className="fade-up font-display text-5xl font-bold leading-[0.95] tracking-[-0.02em] sm:text-7xl">
              Every agent that touches money will need on-chain bounds.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-normal text-muted-foreground sm:text-lg">
              Shopier is the first.{" "}
              <span className="text-foreground">
                Spending policy, session-key delegation, encrypted twin —
                shipped as Anchor programs you can audit on a block explorer.
              </span>{" "}
              Fashion is the first surface running on the primitive.
            </p>

            <HeroCtas />
          </section>

          {/* The first surface — Met Gala featured */}
          <section className="fade-up mb-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-500">
              First surface · live
            </p>
            <FeaturedEventCard />
          </section>

          {/* Inline footnote tying the demo to the protocol */}
          <p className="mb-20 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
            Drop a screenshot or watch a celebrity. Match arrives, 30s cancel
            window, agent settles in USDC inside the bound you signed once.
            No checkout. No race. No Phantom prompt mid-event.
          </p>

          {/* The pattern generalizes — verticals */}
          <VerticalsRow />

          {/* Closing — pointer to architecture */}
          <section className="mb-12 max-w-xl">
            <p className="text-base leading-normal text-muted-foreground">
              Anywhere an agent acts on someone&apos;s behalf, it needs a
              wallet bounded by code on a block explorer.{" "}
              <Link
                href="/architecture"
                className="font-semibold text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
              >
                Read the architecture →
              </Link>
            </p>
          </section>
        </div>

        {/* Right rail — live activity feed (or setup checklist when unconfigured) */}
        <ActivityRail className="lg:sticky lg:top-24 lg:self-start" />
      </main>
    </>
  );
}
