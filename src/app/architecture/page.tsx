import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import AgentMap from "@/components/AgentMap";
import LivePdaPanel from "@/components/architecture/LivePdaPanel";
import { ExternalLink, Zap, Bell, ShieldCheck, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Architecture — Shopier",
  description:
    "Three Anchor programs deployed to Solana devnet. spending_policy, digital_twin, stylist_marketplace.",
};

export default function ArchitecturePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:pb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Architecture
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">
          Three programs, four agents
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Shopier buys clothes on Solana. The agent has its own wallet, its
          own spending policy, its own keys. Every purchase runs through the
          policy before settling. The page below covers the programs that
          enforce that and the agents that run inside them.
        </p>

        <h2 className="mt-10 text-xl font-bold">The four agents</h2>
        <div className="mt-4">
          <AgentMap />
        </div>

        <h2 className="mt-12 text-xl font-bold">Programs, live</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Three Anchor programs on Solana devnet. The panel below pulls
          accounts directly from devnet RPC. Click any program ID for the
          explorer.
        </p>

        <div className="mt-5">
          <LivePdaPanel />
        </div>

        <h2 className="mt-12 text-xl font-bold">The 30-second auto-buy flow</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Three on-chain primitives: set_watch_policy, set_delegate, and
          record_spend_as_delegate. The user signs each one ahead of time.
          When a match arrives, the agent buys without re-prompting Phantom.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <FlowStep
            n="1"
            icon={<Bell size={14} className="text-amber-500" />}
            title="Watch signed"
            primitive="set_watch_policy"
            body="User picks celebs, sets a per-look cap, picks notify or auto-buy mode. Phantom signs once. Lives in the WatchPolicy PDA on digital_twin."
          />
          <FlowStep
            n="2"
            icon={<ShieldCheck size={14} className="text-emerald-500" />}
            title="Delegate signed"
            primitive="set_delegate"
            body="User authorizes an Ed25519 session keypair for N hours, max-per-tx Y. Phantom signs once. Lives in the Delegation PDA on spending_policy."
          />
          <FlowStep
            n="3"
            icon={<Zap size={14} className="text-amber-500" />}
            title="Auto-buy fires"
            primitive="record_spend_as_delegate"
            body="Match arrives. 30s cancel window. If user does nothing, the session key signs the buy — no Phantom prompt. spending_policy re-validates bounds atomically with the USDC transfer."
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          If our backend is compromised, max loss is the spending-policy cap.
          If the session key leaks, max loss is max_per_tx × N until the
          delegation is revoked. Both caps are checked in the program, not in
          our service.
        </p>

        <h2 className="mt-12 text-xl font-bold">Policy semantics</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Read-only checks are owner-authed.</span>{" "}
            The check_spend instruction requires the owner&apos;s signature even
            for simulation, so attackers can&apos;t probe an arbitrary user&apos;s
            spending state.
          </li>
          <li>
            <span className="font-semibold text-foreground">Writes re-validate hard limits.</span>{" "}
            record_spend doesn&apos;t trust the prior check_spend; it re-runs all
            bound checks before mutating the daily counter.
          </li>
          <li>
            <span className="font-semibold text-foreground">Rolling daily window.</span>{" "}
            The daily counter resets when 86,400 seconds have elapsed since
            last_reset_unix. No cron job required.
          </li>
          <li>
            <span className="font-semibold text-foreground">Account TTLs auto-extended.</span>{" "}
            Every state-mutating instruction extends the policy and daily
            account TTLs, so live use keeps the contract alive without manual
            ledger bumps.
          </li>
        </ul>

        <h2 className="mt-12 text-xl font-bold">Off-chain components</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Styling agent</span> —
            Gemini 2.0 Flash (primary), Groq Llama-4-Scout (fallback). Reads
            twin data to adjust commentary per item.
          </li>
          <li>
            <span className="font-semibold text-foreground">Affiliate rail</span> —
            Skimlinks (or per-merchant direct programs). Click tracker logs
            attribution to /c/[handle] cookie; webhook ingests sales and
            splits 70/30 of net commission to the creator.
          </li>
          <li>
            <span className="font-semibold text-foreground">Activation receipts</span> —
            ed25519-signed receipts from theMiracle&apos;s brand console.
            Verified with their public key before treasury operates on a new
            user&apos;s behalf.
          </li>
          <li>
            <span className="font-semibold text-foreground">Signed look attestations</span> —
            Creators sign canonical content hashes with their wallet; the
            signed_by_pubkey + signature columns make curation provenance
            verifiable on the public look pages.
          </li>
        </ul>

        <h2 className="mt-12 text-xl font-bold">Fulfillment bridges</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Shopier&apos;s programs cover trust, identity, spending caps, and
          creator splits. They don&apos;t cover merchant fulfillment —
          Nordstrom doesn&apos;t take USDC. Two bridges fill the gap, both
          integrations with existing Solana-ecosystem products.
        </p>

        <div className="mt-5 rounded-xl border border-border/60 bg-background p-5">
          <p className="text-sm font-semibold">Bridge A — user-payment</p>
          <p className="mt-1 text-xs text-muted-foreground">USDC wallet → fiat merchant checkout</p>
          <p className="mt-3 text-sm text-muted-foreground">
            User holds USDC; merchant takes Visa/Mastercard. The bridge
            converts USDC to a fiat-spending instrument (virtual Visa card) at
            checkout.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Raenest</span>{" "}
              (primary, African markets) — CBN-licensed. USDT/USDC on Solana
              converts 1:1 to USD account balance; virtual Visa card draws
              from that balance. Shopier is in the SuperteamNG × Raenest
              Frontier track.
            </li>
            <li>
              <span className="font-semibold text-foreground">Crossmint</span>{" "}
              (alternative, global) — Headless Checkout API funded by USDC.
              Different vendor, same shape. Used where Raenest doesn&apos;t
              serve.
            </li>
            <li>
              <span className="font-semibold text-foreground">Solana Pay direct</span>{" "}
              (where supported) — for merchants who accept USDC natively. No
              bridge needed.
            </li>
          </ul>
        </div>

        <div className="mt-3 rounded-xl border border-border/60 bg-background p-5">
          <p className="text-sm font-semibold">Bridge B — revenue → creator</p>
          <p className="mt-1 text-xs text-muted-foreground">fiat affiliate commission → on-chain creator USDC payouts</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Skimlinks pays Shopier USD wires monthly for affiliate-attributed
            sales. Creators are owed their cut (70/30 of net commission) in
            USDC. The bridge swaps fiat to USDC via Coinbase Prime or Kraken
            OTC and batches on-chain payouts to creator wallets.
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-muted/10 p-5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">v0 vs v1</p>
          <p className="mt-2">
            Today: agent USDC settlement on devnet routes to a Shopier-managed
            merchant address. No real hoodie ships. The on-chain primitives
            are real; fulfillment is mocked.
          </p>
          <p className="mt-2">
            v1: replace the mock with a Raenest deposit + virtual card flow
            for African users, or Crossmint Headless Checkout for other
            markets. Bridge A code path lives at{" "}
            <code>src/app/api/agent/purchase/route.ts</code>.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/agent"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Open the agent →
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            ← Home
          </Link>
        </div>
      </main>
    </>
  );
}

function FlowStep({
  n,
  icon,
  title,
  primitive,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  primitive: string;
  body: string;
}) {
  return (
    <div className="relative rounded-xl border border-border/60 bg-background p-4">
      <div className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
        {n}
      </div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {primitive}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function ProgramRow({
  name,
  id,
  enforces,
  purpose,
}: {
  name: string;
  id: string;
  enforces: string;
  purpose: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-background p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{name}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          enforces · {enforces}
        </span>
      </div>
      <a
        href={`https://solscan.io/account/${id}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1 break-all font-mono text-[10px] text-muted-foreground hover:text-foreground"
      >
        {id}
        <ExternalLink size={9} />
      </a>
      <p className="mt-3 text-sm text-muted-foreground">{purpose}</p>
    </div>
  );
}
