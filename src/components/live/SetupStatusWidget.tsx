"use client";

import Link from "next/link";
import { Check, ArrowRight, Wallet, Sparkles } from "lucide-react";
import { useSetupStatus } from "@/lib/useSetupStatus";
import { cn } from "@/lib/utils";

/**
 * Setup status checklist.
 *
 * Replaces the activity rail when the user hasn't completed all five
 * prereqs for auto-buy. Each step shows green check or → CTA. The first
 * incomplete step gets a primary CTA; the rest are subdued.
 *
 * Steps are ordered by causal dependency:
 *   1. Wallet → 2. Twin → 3. Policy → 4. Real-time → 5. Watch
 *
 * Once all five are green, this component returns null and the regular
 * ActivityRail takes over. Caller decides via `setup.allReady`.
 */
export default function SetupStatusWidget({
  className,
}: {
  className?: string;
}) {
  const setup = useSetupStatus();

  // Order matters — list in dependency order so the first ✗ is the next action
  const steps = [
    {
      key: "wallet",
      label: "Connect Phantom",
      done: setup.walletConnected,
      cta: setup.walletConnected
        ? null
        : { label: "Use the wallet button (top right)", href: null },
    },
    {
      key: "twin",
      label: "Set up your twin",
      done: setup.twinReady,
      cta: { label: "Open /twin", href: "/twin" },
    },
    {
      key: "policy",
      label: "Initialize spending policy",
      done: setup.policyReady,
      cta: { label: "Open /agent/wallet", href: "/agent/wallet" },
    },
    {
      key: "realtime",
      label: "Enable real-time mode",
      done: setup.realTimeReady,
      cta: { label: "Open /agent", href: "/agent" },
    },
    {
      key: "watch",
      label: "Watch a celeb",
      done: setup.watchCreated,
      cta: { label: "Open /trending", href: "/trending" },
    },
  ];

  // First incomplete step = the user's next action
  const firstIncompleteIdx = steps.findIndex((s) => !s.done);

  return (
    <aside className={className}>
      <div className="rounded-2xl border border-border/60 bg-background p-4">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={12} className="text-amber-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Set up your agent
          </h3>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {setup.completed === 0
            ? "Five steps to enable auto-buy. Each is one signature."
            : `${setup.completed} of ${setup.total} done. Next:`}
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(setup.completed / setup.total) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <ol className="mt-4 space-y-2">
          {steps.map((step, i) => {
            const isNext = i === firstIncompleteIdx;
            return (
              <li key={step.key}>
                <StepRow step={step} index={i + 1} isNext={isNext} />
              </li>
            );
          })}
        </ol>

        {!setup.walletConnected && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <Wallet size={11} className="mt-0.5 shrink-0" />
            <span>
              Don&apos;t have Phantom on devnet?{" "}
              <a
                className="underline underline-offset-2"
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                phantom.app
              </a>
              , then switch to Devnet in Settings → Developer.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function StepRow({
  step,
  index,
  isNext,
}: {
  step: {
    key: string;
    label: string;
    done: boolean;
    cta: { label: string; href: string | null } | null;
  };
  index: number;
  isNext: boolean;
}) {
  const checkClass = step.done
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : isNext
    ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "border-border bg-muted/30 text-muted-foreground";
  const labelClass = step.done
    ? "text-muted-foreground line-through"
    : isNext
    ? "font-semibold text-foreground"
    : "text-foreground";

  const inner = (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
          checkClass
        )}
      >
        {step.done ? <Check size={11} /> : index}
      </span>
      <span className={cn("flex-1 text-[12px]", labelClass)}>{step.label}</span>
      {!step.done && isNext && step.cta?.href && (
        <ArrowRight size={11} className="text-amber-600 dark:text-amber-400" />
      )}
    </div>
  );

  if (!step.done && step.cta?.href) {
    return (
      <Link
        href={step.cta.href}
        className={cn(
          "block rounded-lg p-1.5 transition-colors hover:bg-muted/30",
          isNext && "bg-amber-500/5"
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className="p-1.5">{inner}</div>;
}
