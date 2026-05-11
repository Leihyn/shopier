import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import {
  walletsWatchingCeleb,
  createInboxEntry,
} from "@/lib/watchesDb";
import { allLooks, filterAndRank } from "@/lib/eventsData";
import type { Section, StyleRegister } from "@/lib/solana";

const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

/**
 * Demo-control endpoint that simulates the cron firing for a celebrity.
 *
 * Body: { celebSlug: string, lookId?: string }
 *
 * Behavior: looks up all active watches for that celeb. For each, finds a look
 * matching the watch's section/register/budget filters. Inserts a pending inbox
 * entry. If the watch is auto-buy mode, sets `auto_buy_at` to now+30s; the
 * client polls inbox and shows the countdown.
 *
 * v1 replacement: a real cron service polling SerpAPI google_news for celeb
 * outfit articles, running breakdown, then calling this same matcher.
 */
export async function POST(req: NextRequest) {
  let body: { celebSlug: string; lookId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.celebSlug) {
    return NextResponse.json(
      { error: "celebSlug required" },
      { status: 400 }
    );
  }

  const watches = walletsWatchingCeleb(body.celebSlug);
  if (watches.length === 0) {
    return NextResponse.json({ matched: 0, message: "No active watches for celeb" });
  }

  const looks = allLooks().filter((l) => l.celebSlug === body.celebSlug);
  if (looks.length === 0) {
    return NextResponse.json(
      { matched: 0, error: "No looks indexed for celeb" },
      { status: 404 }
    );
  }

  let matched = 0;
  const created: Array<{ inboxId: string; lookId: string; wallet: string }> = [];

  for (const w of watches) {
    const filtered = filterAndRank(looks, {
      section: (w.sectionFilter ?? undefined) as Section | undefined,
      register: (w.registerFilter ?? undefined) as StyleRegister | undefined,
      maxBudgetUsd: w.maxPerLookUsd,
    });
    const targetLookId = body.lookId ?? filtered[0]?.id;
    const targetLook = filtered.find((l) => l.id === targetLookId) ?? filtered[0];
    if (!targetLook) continue;

    // For event-scoped watches, only fire if the look is from that event.
    if (w.eventScope && targetLook.eventSlug !== w.eventScope) continue;

    const autoBuyAt =
      w.mode === "auto-buy-full" ||
      (w.mode === "auto-buy-under-cap" &&
        targetLook.totalUsdBudget <= w.maxPerLookUsd)
        ? Date.now() + 30_000
        : null;

    const inboxId = newId();
    createInboxEntry({
      id: inboxId,
      watchId: w.id,
      walletPubkey: w.walletPubkey,
      lookId: targetLook.id,
      celebSlug: w.celebSlug,
      totalBudgetUsd: targetLook.totalUsdBudget,
      autoBuyAt,
    });
    created.push({ inboxId, lookId: targetLook.id, wallet: w.walletPubkey });
    matched += 1;
  }

  return NextResponse.json({ matched, created });
}
