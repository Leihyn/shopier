"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Mic,
  User,
  Sparkles,
  Check,
  Zap,
} from "lucide-react";
import { allLooks } from "@/lib/eventsData";

/**
 * OPTION 4 — Conversational shell.
 *
 * The bet: agent-first. The entire app is a single chat thread. Forms,
 * breakdowns, signatures appear as inline message types. Most thesis-pure
 * but riskiest — fragile intent parsing, 12h build, lots of edge cases.
 */
export default function ConversationalPreview() {
  const looks = allLooks().slice(0, 3);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/preview"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={11} /> back
            </Link>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Preview 4 of 5
            </span>
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            Shopier · Agent
          </h1>
          <span className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
            32pS..gEZa
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1fr_240px]">
        {/* Chat thread */}
        <div className="flex h-[calc(100vh-9rem)] flex-col rounded-2xl border border-border/60 bg-background">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-5">
              {/* user msg */}
              <UserMsg
                time="23:14"
                body="set up my twin · I'm 175cm, women's section, neutral colors"
              />
              {/* agent msg with inline form */}
              <AgentMsg time="23:14">
                <p className="text-sm">
                  Got it. Quick form for the rest — most of these accelerate
                  better matches:
                </p>
                <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <FieldStub label="Height" value="175 cm" />
                    <FieldStub label="Chest" value="95 cm" />
                    <FieldStub label="Section" value="womens" />
                    <FieldStub label="Register" value="neutral" />
                    <FieldStub label="Skin tone" value="5 / 10" />
                    <FieldStub label="Climate" value="four-season" />
                  </div>
                  <button className="mt-3 w-full rounded-md bg-foreground py-2 text-[11px] font-semibold text-background">
                    Save · Phantom signs once · encrypted twin PDA
                  </button>
                </div>
              </AgentMsg>

              {/* system attestation */}
              <SystemMsg
                icon={<Check size={12} />}
                body="Twin saved on-chain · tx 2dQS..9MA4 · encrypted"
              />

              {/* user msg */}
              <UserMsg
                time="23:18"
                body="what's hot at the Grammys"
              />
              {/* agent msg with look cards */}
              <AgentMsg time="23:18">
                <p className="text-sm">
                  4 looks indexed from Grammys 2026 · top three for your
                  twin (women&apos;s, neutral register, under your $1,000
                  daily cap):
                </p>
                <div className="mt-2 grid gap-2">
                  {looks.map((l, i) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5"
                    >
                      <div
                        className="aspect-square w-12 shrink-0 rounded-md bg-cover bg-center"
                        style={{ backgroundImage: `url(${l.thumbnailUrl})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">
                          {i + 1}. {l.celeb}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {l.styleSummary}
                        </p>
                      </div>
                      <span className="font-mono text-xs tabular-nums">
                        ${l.totalUsdBudget}
                      </span>
                    </div>
                  ))}
                </div>
              </AgentMsg>

              {/* user msg */}
              <UserMsg time="23:19" body="watch Zendaya, $500 cap auto-buy" />

              {/* agent — phantom signature inline */}
              <AgentMsg time="23:19">
                <p className="text-sm">
                  One Phantom signature. Watching Zendaya, auto-buy under
                  $500 across all events.
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <Check size={14} className="text-emerald-500" />
                  <p className="font-mono text-[11px]">
                    set_watch_policy · sig 5fBa..NyQ8 · slot 461,287,930
                  </p>
                </div>
              </AgentMsg>

              {/* user msg */}
              <UserMsg time="23:21" body="buy the second one" />

              {/* agent — countdown inline */}
              <AgentMsg time="23:21">
                <p className="text-sm">
                  Bella Hadid · after-party · $215 · within your bound.
                  Auto-buying in <strong>27s</strong> — say{" "}
                  <em>cancel</em> to abort.
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                  <Zap size={14} className="text-amber-500" />
                  <div className="flex-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-amber-500/20">
                      <div className="h-full w-[10%] bg-amber-500" />
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums">27s</span>
                </div>
              </AgentMsg>
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border/50 p-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
              <input
                disabled
                placeholder="type or talk to your agent…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button className="text-muted-foreground hover:text-foreground">
                <Mic size={16} />
              </button>
              <button className="rounded-full bg-foreground p-1.5 text-background">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — context panel */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-2xl border border-border/60 bg-background p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Active session
            </p>
            <p className="font-mono text-[11px]">
              Real-time mode <span className="text-emerald-500">●</span> 58m left
            </p>
            <p className="mt-1 font-mono text-[11px]">
              Today · $215 / $1,000
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Watching · 4
            </p>
            <ul className="space-y-1 text-[11px]">
              <li>● Zendaya · auto ≤ $500</li>
              <li>● Bella · notify</li>
              <li>● Rihanna · auto ≤ $1k</li>
              <li>● Tyler · notify</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Recent on-chain
            </p>
            <ul className="space-y-1 font-mono text-[10px] text-muted-foreground">
              <li>set_watch_policy · 5fBa…</li>
              <li>complete_twin_encrypted · 8nWx…</li>
              <li>set_delegate · 2dQS…</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function UserMsg({ time, body }: { time: string; body: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2 pr-1 text-[10px] text-muted-foreground">
        <span>{time}</span>
        <span className="font-semibold uppercase tracking-wider">You</span>
        <User size={10} />
      </div>
      <div className="mt-1 max-w-md rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-sm text-background">
        {body}
      </div>
    </div>
  );
}

function AgentMsg({
  time,
  children,
}: {
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 pl-1 text-[10px] text-muted-foreground">
        <Sparkles size={10} className="text-amber-500" />
        <span className="font-semibold uppercase tracking-wider">Agent</span>
        <span>{time}</span>
      </div>
      <div className="mt-1 max-w-md rounded-2xl rounded-bl-md border border-border/60 bg-background px-3 py-2.5">
        {children}
      </div>
    </div>
  );
}

function SystemMsg({
  icon,
  body,
}: {
  icon: React.ReactNode;
  body: string;
}) {
  return (
    <div className="mx-auto flex max-w-md items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
      {icon}
      <span className="font-mono">{body}</span>
    </div>
  );
}

function FieldStub({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
