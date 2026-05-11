"use client";

import { useEffect, useState } from "react";
import { STABLE_MAINNET_MINTS } from "@/lib/jupiter";

/**
 * Live Jupiter quote hook — polls /api/agent/jupiter/quote every N seconds
 * and exposes the freshest cross-stablecoin rate. Used by the CheckoutSection
 * to surface real Jupiter pricing in the UI even though our app settles on
 * devnet (where Jupiter isn't deployed).
 *
 * When `fromAsset === toAsset`, no swap is needed — we return a synthetic
 * quote with rate 1.0 so the caller's render path is uniform.
 */

export interface JupiterQuoteState {
  loading: boolean;
  rate: number | null; // outAmount / inAmount, decimal-aware
  priceImpactPct: number | null;
  slippageBps: number | null;
  inAmount: string | null;
  outAmount: string | null;
  routeStepCount: number | null;
  fetchedAt: number | null;
  error: string | null;
}

const INITIAL: JupiterQuoteState = {
  loading: true,
  rate: null,
  priceImpactPct: null,
  slippageBps: null,
  inAmount: null,
  outAmount: null,
  routeStepCount: null,
  fetchedAt: null,
  error: null,
};

interface QuoteResponse {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string | number;
  slippageBps: number;
  routePlan?: unknown[];
}

const STABLE_DECIMALS = 6; // all four stablecoins we surface use 6 decimals

export function useJupiterQuote(opts: {
  /** "USDC" | "USDT" | "EURC" | "PYUSD" — mainnet mints come from STABLE_MAINNET_MINTS */
  fromAsset: string;
  toAsset: string;
  /** USD-denominated amount for display; converted to base units internally */
  amountUsd: number;
  /** Polling interval in ms; default 5s. Pass 0 to disable polling. */
  intervalMs?: number;
  /** When false, hook is inert (returns INITIAL with loading=false). */
  enabled?: boolean;
}): JupiterQuoteState {
  const { fromAsset, toAsset, amountUsd, intervalMs = 5_000, enabled = true } =
    opts;
  const [state, setState] = useState<JupiterQuoteState>(INITIAL);

  useEffect(() => {
    if (!enabled || !amountUsd || amountUsd <= 0) {
      setState({ ...INITIAL, loading: false });
      return;
    }

    // Same-asset path — no swap, render rate 1.0
    if (fromAsset === toAsset) {
      setState({
        loading: false,
        rate: 1,
        priceImpactPct: 0,
        slippageBps: 0,
        inAmount: amountUsd.toFixed(2),
        outAmount: amountUsd.toFixed(2),
        routeStepCount: 0,
        fetchedAt: Date.now(),
        error: null,
      });
      return;
    }

    const inputMint = STABLE_MAINNET_MINTS[fromAsset];
    const outputMint = STABLE_MAINNET_MINTS[toAsset];
    if (!inputMint || !outputMint) {
      setState({
        ...INITIAL,
        loading: false,
        error: `Unsupported pair ${fromAsset} → ${toAsset}`,
      });
      return;
    }

    let cancelled = false;
    const baseUnits = BigInt(Math.round(amountUsd * 10 ** STABLE_DECIMALS));

    async function fetchQuote() {
      try {
        const res = await fetch("/api/agent/jupiter/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputMint,
            outputMint,
            amount: baseUnits.toString(),
            slippageBps: 50,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Jupiter ${res.status}: ${txt.slice(0, 80)}`);
        }
        const data = (await res.json()) as QuoteResponse;
        if (cancelled) return;
        const inHuman = Number(data.inAmount) / 10 ** STABLE_DECIMALS;
        const outHuman = Number(data.outAmount) / 10 ** STABLE_DECIMALS;
        const rate = inHuman > 0 ? outHuman / inHuman : null;
        setState({
          loading: false,
          rate,
          priceImpactPct:
            typeof data.priceImpactPct === "string"
              ? parseFloat(data.priceImpactPct)
              : data.priceImpactPct ?? 0,
          slippageBps: data.slippageBps,
          inAmount: inHuman.toFixed(4),
          outAmount: outHuman.toFixed(4),
          routeStepCount: data.routePlan?.length ?? null,
          fetchedAt: Date.now(),
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: (e as Error).message,
        }));
      }
    }

    fetchQuote();
    if (intervalMs > 0) {
      const id = setInterval(fetchQuote, intervalMs);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [fromAsset, toAsset, amountUsd, intervalMs, enabled]);

  return state;
}
