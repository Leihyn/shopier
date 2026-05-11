import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { getCreator, getCreatorStats } from "@/lib/creatorsDb";
import { getCreatorAffiliateStats } from "@/lib/affiliateDb";
import EnableSubscriptions from "./EnableSubscriptions";

interface Params {
  params: Promise<{ handle: string }>;
}

export const dynamic = "force-dynamic";

export default async function CreatorDashboard({ params }: Params) {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) notFound();
  const stats = getCreatorStats(c.handle);
  const affiliate = getCreatorAffiliateStats(c.handle);
  const cutPct = (c.cutBps / 100).toFixed(1);
  const totalEarnedUsd = stats.totalCommissionUsd + affiliate.totalEarnedUsd;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:pb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Dashboard
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">@{c.handle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Payout address: <code className="text-xs">{c.payoutAddress}</code>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cut · USDC purchases" value={`${cutPct}%`} />
          <Stat label="Cut · affiliate net" value="70%" />
          <Stat label="Unique referred" value={String(stats.uniqueReferred)} />
          <Stat
            label="Total earned"
            value={`$${totalEarnedUsd.toFixed(2)}`}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="USDC purchases" value={String(stats.purchaseCount)} />
          <Stat
            label="USDC earned"
            value={`$${stats.totalCommissionUsd.toFixed(2)}`}
          />
          <Stat label="Affiliate clicks" value={String(affiliate.clickCount)} />
          <Stat
            label="Affiliate earned"
            value={`$${affiliate.totalEarnedUsd.toFixed(2)}`}
          />
        </div>

        <div className="mt-8">
          <EnableSubscriptions
            creatorPubkey={c.pubkey}
            creatorHandle={c.handle}
            bio={c.bio}
          />
        </div>

        <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent activity
        </h2>
        {stats.recentReferrals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            No referrals yet. Share /c/{c.handle} in your bio to start
            attributing.
          </p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
            {stats.recentReferrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-mono text-xs">
                    {r.referredPubkey
                      ? `${r.referredPubkey.slice(0, 6)}…${r.referredPubkey.slice(-4)}`
                      : "anonymous"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.referredAt).toLocaleString()}
                  </p>
                </div>
                {r.purchaseSignature ? (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      ${r.purchaseAmountUsd?.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-green-400">
                      +${r.commissionAmountUsd?.toFixed(2)} earned
                    </p>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">visit</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
          v0: commission attribution is recorded in the local DB. v1: payouts
          settle on-chain via SPL CPI in the same purchase tx, or via a batched
          weekly disbursement signed by the platform treasury.
        </div>
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
