import { NextResponse } from "next/server";
import {
  recentSiteInboxActivity,
  recentSiteWatches,
} from "@/lib/watchesDb";
import { allLooks } from "@/lib/eventsData";

/**
 * Live activity feed for the right rail.
 *
 * Mixes:
 *   · Real recent watches created (SQLite watches DB)
 *   · Real recent auto-buys completed (watch_inbox where status='bought')
 *   · Synthetic system events ("look indexed", "watcher count rising") — used
 *     to keep the feed alive when real activity is sparse, marked with a
 *     `synthetic: true` flag in the response so the rail can label them.
 *
 * Returned entries are sorted newest-first, capped at 20.
 */

interface ActivityEntry {
  id: string;
  kind: "auto-buy" | "indexed" | "watch" | "twin" | "system";
  title: string;
  /** Title template with `{wallet}` placeholder so client can swap in `.sol` resolution */
  titleTemplate?: string;
  detail: string;
  /** On-chain signature, when available (for clickable explorer links) */
  txSig?: string;
  /** Wallet pubkey shorthand (truncated) for attribution */
  wallet?: string;
  /** Full pubkey for client-side SNS resolution */
  walletFull?: string;
  /** Unix ms */
  at: number;
  synthetic: boolean;
}

function shortWallet(pubkey: string): string {
  if (pubkey.length < 10) return pubkey;
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

function shortSig(sig: string): string {
  if (!sig) return "";
  return `${sig.slice(0, 6)}…${sig.slice(-4)}`;
}

/** Hand-curated synthetic events that simulate the heartbeat of a live broadcast. */
function syntheticEntries(now: number): ActivityEntry[] {
  const looks = allLooks();
  const entries: ActivityEntry[] = [];

  // "Look indexed" entries — recent looks "captured" by the styling agent
  for (let i = 0; i < 4; i++) {
    const look = looks[(i * 3) % looks.length];
    entries.push({
      id: `syn-idx-${look.id}`,
      kind: "indexed",
      title: `${look.celeb} look indexed`,
      detail: look.styleSummary.length > 64
        ? look.styleSummary.slice(0, 64) + "…"
        : look.styleSummary,
      at: now - (60_000 + i * 280_000), // staggered 1-20 min ago
      synthetic: true,
    });
  }

  // System events
  entries.push({
    id: "syn-cannes",
    kind: "system",
    title: "Cannes opens in 3 days",
    detail: "47 watchers already armed for premiere week",
    at: now - 540_000,
    synthetic: true,
  });
  entries.push({
    id: "syn-met-stat",
    kind: "system",
    title: "Met Gala stats finalized",
    detail: "12 looks indexed · 47 watchers · 3 auto-buys",
    at: now - 1_320_000,
    synthetic: true,
  });

  return entries;
}

export async function GET() {
  const now = Date.now();
  const out: ActivityEntry[] = [];

  // 1. Real recent auto-buys + cancellations
  try {
    const inbox = recentSiteInboxActivity(15);
    for (const e of inbox) {
      out.push({
        id: `inbox-${e.id}`,
        kind: e.status === "bought" ? "auto-buy" : "watch",
        title:
          e.status === "bought"
            ? `Auto-buy fired · ${e.celebSlug}`
            : `Watch cancelled · ${e.celebSlug}`,
        detail: `$${e.totalBudgetUsd}`,
        txSig: e.boughtTxSig ?? undefined,
        wallet: shortWallet(e.walletPubkey),
        walletFull: e.walletPubkey,
        at: e.createdAt,
        synthetic: false,
      });
    }
  } catch {
    /* swallow */
  }

  // 2. Real recent watches created
  try {
    const watches = recentSiteWatches(15);
    for (const w of watches) {
      out.push({
        id: `watch-${w.id}`,
        kind: "watch",
        // titleTemplate uses {wallet} placeholder for client-side SNS resolution
        title: `${shortWallet(w.walletPubkey)} armed watch`,
        titleTemplate: `{wallet} armed watch`,
        detail: `${w.celebName} · ${
          w.mode === "notify" ? "notify" : `auto ≤ $${w.maxPerLookUsd}`
        }`,
        wallet: shortWallet(w.walletPubkey),
        walletFull: w.walletPubkey,
        at: w.createdAt,
        synthetic: false,
      });
    }
  } catch {
    /* swallow */
  }

  // 3. Synthetic entries — mix in to keep feed lively when real data is sparse
  out.push(...syntheticEntries(now));

  // Sort newest-first, dedupe by id, cap to 20
  const seen = new Set<string>();
  const sorted = out
    .sort((a, b) => b.at - a.at)
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .slice(0, 20);

  // Stamp ago strings server-side for stable display
  const withAgo = sorted.map((e) => ({
    ...e,
    txSigShort: e.txSig ? shortSig(e.txSig) : undefined,
    secondsAgo: Math.max(0, Math.floor((now - e.at) / 1000)),
  }));

  return NextResponse.json({
    entries: withAgo,
    realCount: withAgo.filter((e) => !e.synthetic).length,
    syntheticCount: withAgo.filter((e) => e.synthetic).length,
    fetchedAt: new Date(now).toISOString(),
  });
}
