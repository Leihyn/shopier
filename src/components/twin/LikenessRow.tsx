"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Sparkles, Bell, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  findClosestLikenesses,
  inferBodyType,
  BODY_TYPE_GUIDANCE,
  type LikenessMatch,
  type CelebLikeness,
} from "@/lib/likenessDb";
import type { Section, StyleRegister } from "@/lib/solana";
import { cn } from "@/lib/utils";

interface Props {
  twin: {
    heightCm: number;
    chestCm: number;
    waistCm: number;
    hipCm: number;
    section?: Section;
    styleRegister?: StyleRegister;
  };
}

/**
 * Likeness row — surfaces the closest celebrity matches to the user's twin.
 *
 * Mounted on /twin below the form. Recomputes live as the user adjusts
 * measurements. Each match links to a per-celeb watch action and to that
 * celeb's looks on /trending.
 *
 * The thesis: "what fits them tends to fit you" — leverages public-record
 * body data of celebrities to give users a starting point for taste.
 */
export default function LikenessRow({ twin }: Props) {
  const wallet = useWallet();
  const matches = useMemo(() => findClosestLikenesses(twin, 3), [twin]);
  const userType = useMemo(
    () => inferBodyType(twin.chestCm, twin.waistCm, twin.hipCm),
    [twin.chestCm, twin.waistCm, twin.hipCm]
  );
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-border/60 bg-background p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles size={10} className="text-amber-500" />
            Your matches
          </p>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Bodies similar to yours
          </h2>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          title="Show match math"
        >
          {expanded ? "Hide details" : "Match math"}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* Inferred body type as a small chip */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Your body type
        </span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {userType}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {BODY_TYPE_GUIDANCE[userType]}
        </span>
      </div>

      {/* Matches grid */}
      <div className="grid gap-2 sm:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.celeb.slug} match={m} expanded={expanded} walletConnected={!!wallet.publicKey} />
        ))}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Public-record approximations · what fits them tends to fit you ·
        watching any one tells your agent to surface their future looks
      </p>
    </section>
  );
}

function MatchCard({
  match,
  expanded,
  walletConnected,
}: {
  match: LikenessMatch;
  expanded: boolean;
  walletConnected: boolean;
}) {
  const { celeb, score, factors } = match;
  const pct = Math.round(score * 100);
  const tone =
    pct >= 80
      ? "border-emerald-500/40 bg-emerald-500/5"
      : pct >= 60
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-border bg-background";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-shadow hover:shadow-sm",
        tone
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {celeb.name}
            {celeb.dotsol && (
              <span
                className="rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[8px] text-emerald-700 dark:text-emerald-400"
                title={`${celeb.dotsol}.sol · SNS verified`}
              >
                ✓ .sol
              </span>
            )}
          </h3>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {celeb.heightCm}cm · {celeb.type}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums",
            pct >= 80
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : pct >= 60
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
              : "bg-muted/40 text-muted-foreground"
          )}
        >
          {pct}%
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
        {celeb.styleNote}
      </p>

      {expanded && (
        <div className="rounded-md bg-muted/30 p-2 font-mono text-[9px] leading-snug text-muted-foreground">
          <div>type · {(factors.typeScore * 100).toFixed(0)}% · weight 0.50</div>
          <div>ratio · {(factors.ratioScore * 100).toFixed(0)}% · weight 0.25</div>
          <div>height · {(factors.heightScore * 100).toFixed(0)}% · weight 0.15</div>
          <div>section · {(factors.sectionScore * 100).toFixed(0)}% · weight 0.10</div>
        </div>
      )}

      <div className="mt-auto flex items-center gap-1 pt-1">
        <Link
          href={`/trending?celeb=${celeb.slug}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          See looks <ArrowRight size={9} />
        </Link>
        {walletConnected && (
          <Link
            href={`/trending?celeb=${celeb.slug}&watch=1`}
            className="flex items-center gap-1 rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background hover:opacity-90"
            title={`Set up a watch on ${celeb.name}`}
          >
            <Bell size={9} /> Watch
          </Link>
        )}
      </div>
    </div>
  );
}
