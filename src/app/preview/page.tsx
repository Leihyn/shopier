import Link from "next/link";
import { TrendingUp, User, Smartphone, MessageCircle, Newspaper, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Preview · 5 frontend revamp options · Shopier",
};

const OPTIONS = [
  {
    slug: "live-event",
    n: "1",
    title: "Live event broadcast",
    icon: TrendingUp,
    bet: "Time is the killer feature.",
    summary:
      "Polymarket / Kalshi shape. Top live ticker, featured event, real-time activity rail. Auto-buy is the hero. Best demo-impact-per-hour.",
    time: "~6h",
    risk: "Low",
    accent: "border-amber-500/40 bg-amber-500/5",
  },
  {
    slug: "twin-studio",
    n: "2",
    title: "3D twin studio",
    icon: User,
    bet: "Visual differentiation is the killer feature.",
    summary:
      "Persistent rotating 3D figure. Items render onto twin live. Spending bound is an orbital ring. Watches are ghosted celeb silhouettes orbiting your twin.",
    time: "~10h",
    risk: "Medium",
    accent: "border-emerald-500/40 bg-emerald-500/5",
  },
  {
    slug: "vertical-feed",
    n: "3",
    title: "Vertical feed (TikTok)",
    icon: Smartphone,
    bet: "Engagement is the killer feature.",
    summary:
      "Full-screen swipeable look cards. Right-rail icons (watch / share / buy). Double-tap = quick-buy. Mass-market UX. Phone-shaped — awkward on desktop demo.",
    time: "~8h",
    risk: "Medium",
    accent: "border-fuchsia-500/40 bg-fuchsia-500/5",
  },
  {
    slug: "conversational",
    n: "4",
    title: "Conversational shell",
    icon: MessageCircle,
    bet: "Agent-first is the killer feature.",
    summary:
      "Single chat thread is the entire app. Forms, breakdowns, signatures inline as message types. Most agent-thesis-pure but riskiest — fragile intent parsing.",
    time: "~12h",
    risk: "High",
    accent: "border-sky-500/40 bg-sky-500/5",
  },
  {
    slug: "editorial",
    n: "5",
    title: "Editorial magazine + rail",
    icon: Newspaper,
    bet: "Polish is the killer feature.",
    summary:
      "Vogue / Highsnobiety long-form layout with shoppable breakdowns + persistent agent rail (twin / bound / watches / activity). Safe, fast, polished. Lowest novelty.",
    time: "~5h",
    risk: "Lowest",
    accent: "border-rose-500/40 bg-rose-500/5",
  },
];

export default function PreviewIndex() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Five revamp options
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Pick the shape.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Each preview below is a layout sketch — not functional. Look at the
        shape, the information hierarchy, the typography. Click through, then
        tell me which.
      </p>

      <div className="mt-8 grid gap-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <Link
              key={o.slug}
              href={`/preview/${o.slug}`}
              className={`group flex items-start gap-4 rounded-2xl border-2 p-5 transition-all hover:scale-[1.01] hover:shadow-md ${o.accent}`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                {o.n}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon size={16} />
                  <h2 className="font-display text-lg font-semibold tracking-tight">
                    {o.title}
                  </h2>
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {o.bet}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {o.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground">
                    Build · {o.time}
                  </span>
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground">
                    Risk · {o.risk}
                  </span>
                </div>
              </div>
              <ArrowRight
                size={16}
                className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
              />
            </Link>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Previews are layout-only. Not all interactions wire up — judge the shape, not the data.
      </p>
    </main>
  );
}
