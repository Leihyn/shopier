import { notFound } from "next/navigation";
import Link from "next/link";
import { Connection } from "@solana/web3.js";
import Navbar from "@/components/layout/Navbar";
import { getCreator, getCreatorStats } from "@/lib/creatorsDb";
import { fetchSnsRecords } from "@/lib/sns";
import RefTracker from "./RefTracker";
import SubscriptionPanel from "./SubscriptionPanel";

// SNS records live on mainnet — query a separate connection regardless of
// which cluster our app's programs run on.
const SNS_MAINNET_RPC =
  process.env.NEXT_PUBLIC_SNS_MAINNET_RPC ||
  "https://api.mainnet-beta.solana.com";

interface Params {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) return { title: "Creator not found — Shopier" };
  return {
    title: `@${c.handle} on Shopier`,
    description: c.bio,
  };
}

export default async function CreatorPage({ params }: Params) {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) notFound();
  const stats = getCreatorStats(c.handle);
  const cutPct = (c.cutBps / 100).toFixed(1);

  // Pull SNS records (Twitter, GitHub, URL) when the creator has a verified
  // .sol. Server-rendered with a short timeout — if SNS RPC is slow we just
  // fall through to no records.
  let snsRecords: { twitter: string | null; github: string | null; url: string | null } = {
    twitter: null,
    github: null,
    url: null,
  };
  if (c.dotsolName) {
    try {
      const conn = new Connection(SNS_MAINNET_RPC, "confirmed");
      const r = await fetchSnsRecords(conn, c.dotsolName);
      snsRecords = { twitter: r.twitter, github: r.github, url: r.url };
    } catch {
      /* swallow — records are optional polish */
    }
  }
  const hasAnyRecord = snsRecords.twitter || snsRecords.github || snsRecords.url;

  return (
    <>
      <RefTracker handle={c.handle} />
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pt-24 pb-24 sm:pb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Creator referral
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">@{c.handle}</h1>
          {c.dotsolName && (
            <a
              href={`https://www.sns.id/profile/${c.dotsolName}.sol`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted/60"
              title="Verified .sol identity"
            >
              <span className="font-mono">{c.dotsolName}.sol</span>
            </a>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{c.bio}</p>

        {/* SNS records — auto-pulled from the creator's .sol */}
        {hasAnyRecord && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Linked via .sol records
            </span>
            {snsRecords.twitter && (
              <a
                href={`https://twitter.com/${snsRecords.twitter.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 font-medium hover:bg-muted/60"
              >
                @{snsRecords.twitter.replace(/^@/, "")}
              </a>
            )}
            {snsRecords.github && (
              <a
                href={`https://github.com/${snsRecords.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 font-medium hover:bg-muted/60"
              >
                gh/{snsRecords.github}
              </a>
            )}
            {snsRecords.url && (
              <a
                href={
                  snsRecords.url.startsWith("http")
                    ? snsRecords.url
                    : `https://${snsRecords.url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 font-medium hover:bg-muted/60"
              >
                {snsRecords.url.replace(/^https?:\/\//, "").slice(0, 32)}
              </a>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Cut" value={`${cutPct}%`} />
          <Stat label="Referred" value={String(stats.uniqueReferred)} />
          <Stat label="Purchases" value={String(stats.purchaseCount)} />
        </div>

        <div className="mt-8 rounded-xl border border-border/60 bg-muted/20 p-5">
          <p className="text-sm font-semibold">Try Shopier with @{c.handle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drop in any outfit screenshot. Shopier breaks it down, finds
            shoppable matches, and settles in USDC. {cutPct}% of every
            purchase you make today flows to @{c.handle}.
          </p>
          <Link
            href="/agent"
            className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Open the agent →
          </Link>
        </div>

        {/* On-chain subscription panel — appears only if @handle has registered a StylistProfile PDA */}
        <SubscriptionPanel creatorPubkey={c.pubkey} creatorHandle={c.handle} />

        <p className="mt-6 text-xs text-muted-foreground">
          Are you {c.handle}?{" "}
          <Link href={`/c/${c.handle}/dashboard`} className="underline">
            View your dashboard
          </Link>
        </p>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
