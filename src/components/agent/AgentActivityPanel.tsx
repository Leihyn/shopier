"use client";

import { Loader2, CheckCircle2, XCircle, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityStep =
  | "vision"
  | "twin-load"
  | "match"
  | "publish"
  | "policy-sim"
  | "settle"
  | "record"
  | "creator-attribution"
  | "activation";

export type ActivityStatus = "active" | "done" | "failed";

export interface ActivityEvent {
  id: string;
  step: ActivityStep;
  status: ActivityStatus;
  startedAt: number;
  endedAt?: number;
  detail?: string;
  error?: string;
  /** Optional explorer link or external reference */
  link?: { url: string; label: string };
  /** Cost paid for this step, in USDC (or note like "$0.003 via x402") */
  cost?: string;
}

const STEP_LABEL: Record<ActivityStep, string> = {
  vision: "Vision decompose",
  "twin-load": "Twin context",
  match: "Product matching",
  publish: "Publish look",
  "policy-sim": "Spending policy simulation",
  settle: "Settlement (USDC)",
  record: "record_spend on-chain",
  "creator-attribution": "Creator attribution",
  activation: "Activation redeem",
};

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: ActivityStatus }) {
  if (status === "active") {
    return <Loader2 size={12} className="animate-spin text-foreground" />;
  }
  if (status === "failed") {
    return <XCircle size={12} className="text-red-400" />;
  }
  return <CheckCircle2 size={12} className="text-green-500" />;
}

export default function AgentActivityPanel({
  events,
}: {
  events: ActivityEvent[];
}) {
  if (events.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wider">
          <Sparkles size={11} />
          Agent activity
        </div>
        <p className="mt-2 leading-relaxed">
          Drop in a screenshot to see the agent&apos;s pipeline run live —
          vision, twin-aware commentary, retailer matching, policy simulation,
          on-chain settlement, attribution.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles size={11} />
        Agent activity
      </div>
      <ol className="space-y-1.5">
        {events.map((e) => {
          const dur = e.endedAt ? e.endedAt - e.startedAt : Date.now() - e.startedAt;
          return (
            <li
              key={e.id}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] transition-colors",
                e.status === "active" && "bg-muted/50",
                e.status === "done" && "bg-transparent",
                e.status === "failed" && "bg-red-500/10"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={e.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{STEP_LABEL[e.step]}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatDuration(dur)}
                    </span>
                  </div>
                  {e.detail && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {e.detail}
                    </p>
                  )}
                  {e.cost && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      cost: {e.cost}
                    </p>
                  )}
                  {e.error && (
                    <p className="mt-0.5 text-[10px] text-red-400">{e.error}</p>
                  )}
                  {e.link && (
                    <a
                      href={e.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {e.link.label}
                      <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
