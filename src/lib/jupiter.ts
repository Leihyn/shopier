/**
 * Jupiter aggregator integration — auto-fund the agent's USDC balance from
 * any other SPL token (typically SOL) at purchase time.
 *
 * Flow:
 *   1. Before signing the purchase tx, client checks USDC balance
 *   2. If insufficient, calls /api/agent/jupiter/quote with shortfall
 *   3. Server returns Jupiter swap quote + serialized tx
 *   4. Client signs the swap, then signs the purchase, both in same approval window
 *
 * Jupiter API: https://lite-api.jup.ag (no key required for public quote/swap)
 */

import { PublicKey } from "@solana/web3.js";

const JUP_BASE = "https://lite-api.jup.ag";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

// Mainnet mints — Jupiter only quotes against mainnet liquidity. Devnet
// settlement uses the Shopier devnet mints; Jupiter quotes are display-only
// preview of what mainnet routing would cost.
export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MAINNET_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const EURC_MAINNET_MINT = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr"; // Circle Euro
export const PYUSD_MAINNET_MINT = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"; // PayPal USD

/**
 * Multi-stablecoin pair routing — returns the input/output mints for a
 * Jupiter quote based on the cross-stablecoin direction we want to surface.
 * When `from === to` we return null (no swap needed, just settle direct).
 */
export interface StablePair {
  inputMint: string;
  outputMint: string;
  from: string;
  to: string;
}

export const STABLE_MAINNET_MINTS: Record<string, string> = {
  USDC: USDC_MAINNET_MINT,
  USDT: USDT_MAINNET_MINT,
  EURC: EURC_MAINNET_MINT,
  PYUSD: PYUSD_MAINNET_MINT,
};

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  /** Amount in input mint's base units */
  amount: bigint;
  slippageBps?: number;
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  /** Original raw response — pass through to /swap */
  raw: unknown;
}

export async function getQuote(
  req: QuoteRequest
): Promise<QuoteResponse | null> {
  const params = new URLSearchParams({
    inputMint: req.inputMint,
    outputMint: req.outputMint,
    amount: req.amount.toString(),
    slippageBps: String(req.slippageBps ?? 50),
    onlyDirectRoutes: "false",
  });
  const url = `${JUP_BASE}/swap/v1/quote?${params.toString()}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error("Jupiter quote", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as Omit<QuoteResponse, "raw">;
    return { ...data, raw: data };
  } catch (err) {
    console.error("Jupiter quote network error", err);
    return null;
  }
}

export interface SwapRequest {
  quoteResponse: unknown;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}

export interface SwapResponse {
  /** Base64-encoded serialized transaction the user must sign */
  swapTransaction: string;
  /** Last block height for confirmation timing */
  lastValidBlockHeight: number;
}

export async function getSwapTransaction(
  req: SwapRequest
): Promise<SwapResponse | null> {
  const url = `${JUP_BASE}/swap/v1/swap`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse: req.quoteResponse,
        userPublicKey: req.userPublicKey,
        wrapAndUnwrapSol: req.wrapAndUnwrapSol ?? true,
        dynamicComputeUnitLimit: true,
      }),
    });
    if (!res.ok) {
      console.error("Jupiter swap", res.status, await res.text().catch(() => ""));
      return null;
    }
    return (await res.json()) as SwapResponse;
  } catch (err) {
    console.error("Jupiter swap network error", err);
    return null;
  }
}

/** Sanity check that a token mint string parses as a valid Solana pubkey. */
export function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}
