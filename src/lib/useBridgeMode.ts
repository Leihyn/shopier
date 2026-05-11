"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Bridge mode — which Bridge A adapter is active for the current user.
 *
 *   · "lagos"   — Raenest (USDC → NGN remittance, virtual Visa)
 *   · "global"  — Crossmint (USDC → fiat checkout for everywhere else)
 *
 * Persists to localStorage so the choice survives reloads. Default: tries to
 * geo-detect via Cloudflare's `cf-ipcountry` header surfaced through the
 * server-side `/api/geo` route; falls back to "global" if unknown.
 *
 * For the Frontier demo this is a manual switch — judges can flip it to see
 * the Raenest narrative explicitly. v1 will auto-route based on the
 * shipping-address country detected at checkout.
 */

export type BridgeMode = "lagos" | "global";

const STORAGE_KEY = "shopier:bridge-mode";

export function useBridgeMode(): {
  mode: BridgeMode;
  setMode: (m: BridgeMode) => void;
  toggle: () => void;
} {
  const [mode, setModeState] = useState<BridgeMode>("global");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as BridgeMode | null;
      if (saved === "lagos" || saved === "global") setModeState(saved);
    } catch {
      /* swallow */
    }
  }, []);

  const setMode = useCallback((m: BridgeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* swallow */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "lagos" ? "global" : "lagos");
  }, [mode, setMode]);

  return { mode, setMode, toggle };
}
