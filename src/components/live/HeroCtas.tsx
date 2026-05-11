"use client";

import Link from "next/link";
import { TrendingUp, ArrowRight, Wallet } from "lucide-react";
import { useSetupStatus } from "@/lib/useSetupStatus";

/**
 * State-aware hero CTAs.
 *
 * Same hero copy, two buttons that adapt to user progress through the
 * setup chain. Each state surfaces the next-best action as primary and a
 * lateral browse option as secondary.
 *
 * The primary button always points the user one step deeper into the
 * product. The secondary always lets them browse / explore without setup.
 */
export default function HeroCtas() {
  const setup = useSetupStatus();

  const variants = (() => {
    if (!setup.walletConnected) {
      return {
        primary: {
          // No href — clicking just scrolls to the wallet button hint at bottom
          // of the hero. The actual wallet flow is the navbar's Wallet button.
          label: "Get started",
          href: "#wallet-hint",
          icon: <Wallet size={14} />,
        },
        secondary: { label: "How it works", href: "/architecture" },
      };
    }
    if (!setup.twinReady) {
      return {
        primary: {
          label: "Set up your twin",
          href: "/twin",
          icon: <ArrowRight size={14} />,
        },
        secondary: { label: "Browse trending", href: "/trending" },
      };
    }
    if (!setup.policyReady) {
      return {
        primary: {
          label: "Initialize spending policy",
          href: "/agent/wallet",
          icon: <ArrowRight size={14} />,
        },
        secondary: { label: "Browse trending", href: "/trending" },
      };
    }
    if (!setup.realTimeReady) {
      return {
        primary: {
          label: "Enable real-time mode",
          href: "/agent",
          icon: <ArrowRight size={14} />,
        },
        secondary: { label: "Browse trending", href: "/trending" },
      };
    }
    if (!setup.watchCreated) {
      return {
        primary: {
          label: "Watch your first celeb",
          href: "/trending",
          icon: <ArrowRight size={14} />,
        },
        secondary: { label: "Drop a screenshot", href: "/agent" },
      };
    }
    // Fully set up
    return {
      primary: {
        label: "See trending now",
        href: "/trending",
        icon: <TrendingUp size={14} />,
      },
      secondary: { label: "Drop a screenshot", href: "/agent" },
    };
  })();

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href={variants.primary.href}
        className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        {variants.primary.icon}
        {variants.primary.label}
      </Link>
      <Link
        href={variants.secondary.href}
        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
      >
        {variants.secondary.label}
      </Link>
    </div>
  );
}
