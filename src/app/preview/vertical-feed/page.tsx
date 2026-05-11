"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Bell,
  Heart,
  Share2,
  Zap,
  ChevronUp,
  ChevronDown,
  Menu,
  Globe2,
} from "lucide-react";
import { allLooks } from "@/lib/eventsData";

/**
 * OPTION 3 — TikTok-style vertical feed.
 *
 * The bet: engagement. Every interaction collapses to a single vertical
 * scroll. Look = full-screen card. Right rail = watch / share / buy / more.
 * Spending bound = thin pinned bottom bar. Mobile-first; desktop renders in
 * a phone-sized viewport.
 */
export default function VerticalFeedPreview() {
  const looks = allLooks();
  const [idx, setIdx] = useState(0);
  const look = looks[idx];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top utility bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-2 backdrop-blur">
        <Link
          href="/preview"
          className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
        >
          <ArrowLeft size={11} /> back
        </Link>
        <span className="text-xs uppercase tracking-wider text-white/60">
          Preview 3 of 5
        </span>
        <span className="text-xs text-white/60">phone-shaped</span>
      </div>

      <div className="mx-auto flex max-w-md flex-col px-3 pt-4 pb-3">
        {/* Phone-sized container */}
        <div className="relative overflow-hidden rounded-[36px] border-4 border-white/10 bg-zinc-900 shadow-2xl">
          {/* In-app top bar */}
          <div className="relative z-10 flex items-center justify-between p-3 text-white">
            <Menu size={18} />
            <button className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              <Globe2 size={10} /> Lagos · Raenest
            </button>
          </div>

          {/* Full-screen card */}
          <div
            className="relative aspect-[9/16] w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${look.thumbnailUrl})` }}
          >
            {/* Top fade */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-black/15 to-transparent" />
            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

            {/* Right rail — TikTok-style icon stack */}
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4">
              <RailIcon icon={<Heart size={20} />} label="Watch" />
              <RailIcon icon={<Zap size={20} />} label="Buy" highlight />
              <RailIcon icon={<Share2 size={20} />} label="Share" />
              <RailIcon icon={<Bell size={20} />} label="Alert" />
            </div>

            {/* Bottom info */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-6 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                {look.event}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                {look.celeb}
              </h2>
              <p className="mt-1 text-xs leading-snug opacity-80">
                {look.styleSummary}
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums">
                ${look.totalUsdBudget}
                <span className="ml-2 rounded bg-emerald-500/30 px-1 py-0.5 font-mono text-[10px] font-semibold text-emerald-200">
                  ≈ ₦{(look.totalUsdBudget * 1530).toLocaleString("en-NG", { maximumFractionDigits: 0 })}
                </span>
              </p>
              <button className="mt-3 w-full rounded-full bg-white py-3 text-xs font-bold text-black">
                Auto-buy ≤ $500 · Phantom signs once
              </button>
            </div>

            {/* Swipe hints */}
            <button
              onClick={() => setIdx((idx + looks.length - 1) % looks.length)}
              className="absolute left-1/2 top-3 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => setIdx((idx + 1) % looks.length)}
              className="absolute left-1/2 bottom-2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Pinned spending bound */}
          <div className="border-t border-white/10 bg-black/80 px-4 py-2.5 backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/70">
              <span className="uppercase tracking-wider">Today</span>
              <span className="font-mono tabular-nums">$215 / $1,000</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[21%] bg-emerald-400" />
            </div>
          </div>
        </div>

        {/* Beneath: indicator dots + commentary */}
        <div className="mt-3 flex justify-center gap-1.5">
          {looks.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === idx ? "w-6 bg-white" : "w-1 bg-white/30"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-white/40">
          Swipe up = next look · Double-tap = quick-buy at budget tier ·
          Long-press = full breakdown
        </p>
      </div>
    </main>
  );
}

function RailIcon({
  icon,
  label,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <button className="flex flex-col items-center gap-0.5 text-white">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur ${
          highlight ? "bg-amber-500" : "bg-white/15"
        }`}
      >
        {icon}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
