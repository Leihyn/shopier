import Link from "next/link";
import { ArrowLeft, ShoppingBag, Bell, Activity } from "lucide-react";
import { GRAMMYS_2026 } from "@/lib/eventsData";

export const metadata = {
  title: "Preview 5 · Editorial magazine + rail · Shopier",
};

/**
 * OPTION 5 — Editorial magazine + rail.
 *
 * The bet: polish. Long-form Vogue / Highsnobiety editorial layout with
 * shoppable look breakdowns inline + persistent agent rail (twin / bound
 * / watches / activity). Lowest novelty but lowest risk; reads serious.
 */
export default function EditorialPreview() {
  const event = GRAMMYS_2026;

  return (
    <main className="min-h-screen">
      {/* Top utility */}
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
              Preview 5 of 5
            </span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tighter">
            SHOPIER
          </h1>
          <span className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
            32pS..gEZa
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_280px]">
        {/* Editorial article */}
        <article className="prose-editorial max-w-none">
          {/* Issue tag */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-500">
            Issue 04 · February 2026 · Red Carpet
          </p>

          {/* Headline */}
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-7xl">
            Soft power, sharp tailoring.
          </h1>
          <p className="mt-3 max-w-2xl font-display text-xl leading-tight text-muted-foreground">
            The {event.title} red carpet leaned dramatic. We catalogued the
            ten looks our agent flagged as worth owning — and made each one
            shoppable in a tap.
          </p>

          {/* Byline */}
          <p className="mt-6 border-y border-border/40 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            By the styling agent · {event.date} · {event.venue} · 12 looks
            indexed
          </p>

          {/* Hero image */}
          <div className="mt-8 overflow-hidden rounded-sm">
            <div
              className="aspect-[16/9] w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${event.heroImage})` }}
            />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              The carpet · 18:00 PT · Crypto.com Arena
            </p>
          </div>

          {/* Drop cap intro */}
          <div className="mt-10 max-w-2xl">
            <p className="text-base leading-[1.7]">
              <span className="font-display float-left mr-2 text-7xl font-bold leading-[0.85]">
                T
              </span>
              his year, soft power dressed itself in sculpture. Where the
              2024 carpet pushed minimalism and the 2025 edition leaned
              maximalist, 2026 found a third path: structured volume in
              quiet color, embroidery as architecture, tailoring that
              refuses to apologize.
            </p>
            <p className="mt-4 text-base leading-[1.7]">
              Below, the four looks our styling agent flagged as both
              culturally relevant and shoppable within your spending bound.
              Each is broken down into its component pieces, with three
              price tiers — from real-budget to couture-equivalent.
            </p>
          </div>

          {/* Shoppable look 1 */}
          <ShoppableLook
            n="01"
            celeb={event.looks[0].celeb}
            occasion={event.looks[0].occasion}
            summary={event.looks[0].styleSummary}
            image={event.looks[0].thumbnailUrl}
            budget={event.looks[0].totalUsdBudget}
            mid={event.looks[0].totalUsdMid}
            premium={event.looks[0].totalUsdPremium}
            commentary="Zendaya led with what felt almost engineered — a column gown in metallic silver with structural shoulders that telegraphed authority before she'd said a word. The chrome cuff was the punch line."
          />

          {/* Inline pull quote */}
          <blockquote className="mx-auto my-12 max-w-xl border-l-4 border-amber-500 pl-6 font-display text-2xl leading-snug">
            &ldquo;The agent caught it 8 minutes after the post hit. Bought
            in 30 seconds. I never opened a website.&rdquo;
            <footer className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              — Faruq, Lagos · early user
            </footer>
          </blockquote>

          {/* Shoppable look 2 */}
          <ShoppableLook
            n="02"
            celeb={event.looks[2].celeb}
            occasion={event.looks[2].occasion}
            summary={event.looks[2].styleSummary}
            image={event.looks[2].thumbnailUrl}
            budget={event.looks[2].totalUsdBudget}
            mid={event.looks[2].totalUsdMid}
            premium={event.looks[2].totalUsdPremium}
            commentary="The after-party was where the tailoring went off-leash. Bella's mesh-and-leather pairing is the look that defines the rest of the year. We've already seen it copied at Cannes."
          />

          <ShoppableLook
            n="03"
            celeb={event.looks[1].celeb}
            occasion={event.looks[1].occasion}
            summary={event.looks[1].styleSummary}
            image={event.looks[1].thumbnailUrl}
            budget={event.looks[1].totalUsdBudget}
            mid={event.looks[1].totalUsdMid}
            premium={event.looks[1].totalUsdPremium}
            commentary="Tyler's pistachio three-piece doesn't read masculine or feminine — it reads expensive. We translated it to your section + register at $420 budget · $1,140 mid · $3,400 premium."
          />

          <p className="mt-12 max-w-2xl text-base leading-[1.7]">
            Watch any name above and your agent will surface their next
            look — the moment it&apos;s indexed — within the bounds you
            signed once on Solana. No checkout. No race. Just culture, on
            the rails of stablecoin commerce.
          </p>

          <p className="mt-8 border-t border-border/40 pt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
            Next issue · Cannes Film Festival · May 13–24
          </p>
        </article>

        {/* Persistent agent rail */}
        <aside className="lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="mb-3 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              ★ Your agent
            </p>

            {/* Twin mini */}
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <div className="flex h-12 w-8 flex-col items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-foreground/20" />
                <div className="mt-0.5 h-5 w-2 rounded-sm bg-foreground/20" />
                <div className="mt-0.5 h-3 w-1.5 rounded-sm bg-foreground/20" />
              </div>
              <div>
                <p className="text-xs font-semibold">Twin · encrypted</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  175cm · Tone 5 · neutral
                </p>
              </div>
            </div>

            {/* Bound */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Today
              </p>
              <div className="mb-1 flex items-baseline justify-between font-mono text-xs">
                <span className="font-semibold">$215</span>
                <span className="text-muted-foreground">/ $1,000</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
                <div className="h-full w-[21%] bg-emerald-500" />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                $785 left · resets in 18h 22m
              </p>
            </div>

            {/* Watches */}
            <div className="mb-4 border-t border-border/40 pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Bell size={10} /> Watching
              </p>
              <ul className="space-y-1 text-[11px]">
                <li>● Zendaya · auto ≤ $500</li>
                <li>● Bella · notify</li>
                <li>● Rihanna · auto ≤ $1k</li>
                <li>● Tyler · notify</li>
              </ul>
            </div>

            {/* Activity */}
            <div className="border-t border-border/40 pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Activity size={10} /> Recent
              </p>
              <ul className="space-y-2 text-[10px]">
                <li>
                  <p className="font-semibold">⚡ Bought · $215</p>
                  <p className="font-mono text-muted-foreground">
                    Bella · 2m ago
                  </p>
                </li>
                <li>
                  <p className="font-semibold">🔔 Watch armed · Zendaya</p>
                  <p className="font-mono text-muted-foreground">11m ago</p>
                </li>
                <li>
                  <p className="font-semibold">✓ Twin updated</p>
                  <p className="font-mono text-muted-foreground">23m ago</p>
                </li>
              </ul>
            </div>
          </div>

          {/* Sidebar CTA */}
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-90">
            <ShoppingBag size={12} /> Shop entire issue · $1,140
          </button>
        </aside>
      </div>
    </main>
  );
}

function ShoppableLook({
  n,
  celeb,
  occasion,
  summary,
  image,
  budget,
  mid,
  premium,
  commentary,
}: {
  n: string;
  celeb: string;
  occasion: string;
  summary: string;
  image: string;
  budget: number;
  mid: number;
  premium: number;
  commentary: string;
}) {
  return (
    <section className="my-12 grid gap-4 sm:grid-cols-[1fr_2fr]">
      <div className="overflow-hidden rounded-sm">
        <div
          className="aspect-[3/4] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        />
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-700 dark:text-amber-500">
          Look {n} · {occasion}
        </p>
        <h2 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight">
          {celeb}
        </h2>
        <p className="mt-2 text-sm font-medium leading-snug">{summary}</p>
        <p className="mt-3 max-w-prose text-base leading-[1.7]">
          {commentary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background">
            Buy from ${budget}
          </button>
          <button className="rounded-full border border-border px-4 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Mid ${mid}
          </button>
          <button className="rounded-full border border-border px-4 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Premium ${premium}
          </button>
          <button className="rounded-full border border-border px-4 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Watch celeb
          </button>
        </div>
      </div>
    </section>
  );
}
