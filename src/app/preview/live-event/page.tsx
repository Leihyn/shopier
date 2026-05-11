import Link from "next/link";
import LookCard from "@/components/watches/LookCard";
import { ALL_EVENTS, allLooks } from "@/lib/eventsData";
import {
  Activity,
  ArrowLeft,
  Zap,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react";

export const metadata = {
  title: "Preview 1 · Live event broadcast · Shopier",
};

/**
 * OPTION 1 — Live event broadcast.
 *
 * The bet: time is the killer feature. The agent acts at the speed of
 * culture — make that speed felt by framing the entire app as a real-time
 * event broadcast.
 *
 * Layout shape:
 *   - Persistent top ticker shows live event status across the whole app
 *   - Featured event hero takes the upper third
 *   - Activity rail on the right streams site-wide tx confirmations
 *   - Look grid below
 *   - Auto-buys, when they fire, become full-width strips not corner pills
 */
export default function LiveEventPreview() {
  const featured = ALL_EVENTS[0]; // Grammys
  const rest = allLooks().filter((l) => l.eventSlug !== featured.slug).slice(0, 8);

  return (
    <main className="min-h-screen">
      {/* Live ticker — persistent on every page in this option */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-transparent px-4 py-1.5 text-[11px] font-semibold backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">LIVE</span>
        </span>
        <span className="font-display tracking-tight">MET GALA 2026</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono tabular-nums">12 looks</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono tabular-nums">47 watching</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
          3 auto-buys fired in last hour
        </span>
        <Link
          href="/preview"
          className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={10} /> back
        </Link>
      </div>

      {/* Faux navbar */}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="font-display text-lg font-bold tracking-tight">Shopier</h1>
          <nav className="flex gap-1 text-sm text-muted-foreground">
            <span className="rounded-lg px-3 py-1.5 font-semibold text-foreground">Home</span>
            <span className="rounded-lg px-3 py-1.5">Trending</span>
            <span className="rounded-lg px-3 py-1.5">Agent</span>
            <span className="rounded-lg px-3 py-1.5">Twin</span>
          </nav>
          <span className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
            32pS..gEZa
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          {/* Featured event hero */}
          <section className="overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-rose-500/5 p-1">
            <div className="rounded-[20px] bg-background p-6">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                  Featured · live now
                </span>
                <span className="text-muted-foreground">·</span>
                <Clock size={10} className="text-muted-foreground" />
                <span className="font-mono tabular-nums text-muted-foreground">
                  18 min in
                </span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {featured.description}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
                {/* Hero look */}
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <div
                    className="aspect-[16/9] w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${featured.heroImage})` }}
                  />
                </div>
                {/* Live stats */}
                <div className="grid gap-2">
                  <Stat
                    icon={<TrendingUp size={11} className="text-emerald-500" />}
                    label="Looks indexed"
                    value="12"
                  />
                  <Stat
                    icon={<Users size={11} className="text-sky-500" />}
                    label="Active watchers"
                    value="47"
                  />
                  <Stat
                    icon={<Zap size={11} className="text-amber-500" />}
                    label="Auto-buys fired"
                    value="3"
                    sub="last hour"
                  />
                  <button className="mt-1 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-90">
                    Watch entire event · Phantom signs
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Look grid below event */}
          <section className="mt-6">
            <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              All looks · ranked for your twin
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.slice(0, 6).map((look) => (
                <LookCard key={look.id} look={look} />
              ))}
            </div>
          </section>
        </div>

        {/* Activity rail — site-wide live feed */}
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <Activity size={11} className="text-emerald-500" />
              Live activity
            </h3>
            <div className="space-y-3">
              <ActivityItem
                kind="auto-buy"
                title="Faruq · auto-buy fired"
                detail="Rihanna look · $470 · ≈ ₦719k"
                sig="2dQS..9MA4"
                ago="2m"
              />
              <ActivityItem
                kind="indexed"
                title="New look indexed"
                detail="Hailey Bieber · ice-blue silk shift"
                ago="4m"
              />
              <ActivityItem
                kind="watch"
                title="9 new watchers · Met Gala"
                detail="Auto-buy enabled by 3 of 9"
                ago="6m"
              />
              <ActivityItem
                kind="auto-buy"
                title="Wallet 2K9p..bxLm"
                detail="Auto-buy fired · $355 · Zendaya"
                sig="5fBa..NyQ8"
                ago="8m"
              />
              <ActivityItem
                kind="indexed"
                title="Kendall look indexed"
                detail="Sheer cream embroidered gown"
                ago="11m"
              />
              <ActivityItem
                kind="watch"
                title="Watch revoked · 2pXq..ABCd"
                detail="A$AP · max-cap reached"
                ago="14m"
              />
            </div>
            <p className="mt-3 border-t border-border/40 pt-3 text-[10px] leading-relaxed text-muted-foreground">
              All entries are signed transactions. Click any to view on
              Solana Explorer.
            </p>
          </div>

          {/* Spending bound mini */}
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Today</span>
              <span className="font-mono">$215 / $1,000</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div className="h-full w-[21%] bg-emerald-500" />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              $785 remaining · resets in 18h 22m
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
      {sub && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}

function ActivityItem({
  kind,
  title,
  detail,
  sig,
  ago,
}: {
  kind: "auto-buy" | "indexed" | "watch";
  title: string;
  detail: string;
  sig?: string;
  ago: string;
}) {
  const iconBg =
    kind === "auto-buy"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : kind === "indexed"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  const iconChar = kind === "auto-buy" ? "⚡" : kind === "indexed" ? "🆕" : "🔔";
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${iconBg}`}
      >
        {iconChar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {sig && (
            <>
              <span className="font-mono">{sig}</span>
              <span> · </span>
            </>
          )}
          {ago} ago
        </p>
      </div>
    </div>
  );
}
