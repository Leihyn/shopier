// Covalent (GoldRush) wrapper.
// Reads indexed Solana data without round-tripping through our own RPC.
// All functions degrade gracefully when COVALENT_API_KEY is unset.
//
// Get a key: https://goldrush.dev/

const BASE = "https://api.covalenthq.com/v1";
const SOLANA_CHAIN_ID = "solana-mainnet"; // Covalent's Solana network slug

export function covalentConfigured(): boolean {
  return !!process.env.COVALENT_API_KEY;
}

interface CovalentResult<T> {
  ok: true;
  data: T;
}
interface CovalentError {
  ok: false;
  error: string;
}

async function covalentGet<T>(
  path: string
): Promise<CovalentResult<T> | CovalentError> {
  const key = process.env.COVALENT_API_KEY;
  if (!key) return { ok: false, error: "COVALENT_API_KEY not set" };
  const url = `${BASE}${path}`;
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      return { ok: false, error: `Covalent ${r.status}: ${await r.text()}` };
    }
    const json = (await r.json()) as { data: T; error?: boolean; error_message?: string };
    if (json.error) {
      return { ok: false, error: json.error_message || "Covalent error" };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface CovalentTx {
  tx_hash: string;
  block_signed_at: string;
  from_address: string;
  to_address: string;
  delta: string;
  contract_decimals: number;
  contract_ticker_symbol: string;
  contract_address: string;
}

interface TxsResponse {
  items: CovalentTx[];
}

/**
 * List token transfers for a wallet on Solana mainnet.
 * For devnet, Covalent doesn't index — use the SQLite + RPC fallback.
 */
export async function listWalletTransactions(
  wallet: string
): Promise<{ ok: true; transactions: CovalentTx[] } | CovalentError> {
  const r = await covalentGet<TxsResponse>(
    `/${SOLANA_CHAIN_ID}/address/${wallet}/transactions_v3/?page-size=100`
  );
  if (!r.ok) return r;
  return { ok: true, transactions: r.data.items };
}

/**
 * Augments a creator's stats with Covalent-indexed payment history.
 * Used by the dashboard when the user wants live on-chain truth instead of
 * SQLite-recorded attributions.
 */
export async function fetchCreatorOnChainPayouts(
  creatorPayoutAta: string
): Promise<{ ok: true; totalUsdc: number; count: number } | CovalentError> {
  const r = await covalentGet<TxsResponse>(
    `/${SOLANA_CHAIN_ID}/address/${creatorPayoutAta}/transactions_v3/?page-size=200`
  );
  if (!r.ok) return r;
  // Sum incoming USDC transfers. Token mint of mainnet USDC.
  const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  let total = 0;
  let count = 0;
  for (const tx of r.data.items) {
    if (tx.contract_address === USDC_MAINNET && tx.to_address === creatorPayoutAta) {
      total += Number(tx.delta) / 10 ** tx.contract_decimals;
      count += 1;
    }
  }
  return { ok: true, totalUsdc: total, count };
}

export interface PortfolioBalance {
  /** Token symbol (USDC, USDT, SOL etc) */
  ticker: string;
  /** Human balance, decimals applied */
  balance: number;
  /** Recent USD value at fetch time */
  quoteUsd: number;
}

interface BalancesResponse {
  items: Array<{
    contract_ticker_symbol?: string;
    contract_decimals?: number;
    balance?: string;
    quote?: number;
  }>;
}

/**
 * Wallet portfolio summary — top stablecoin/SOL balances + USD totals.
 * Used by /me/purchases header to surface the user's snapshot.
 */
export async function fetchPortfolioSummary(
  wallet: string
): Promise<
  | { ok: true; total: number; balances: PortfolioBalance[] }
  | CovalentError
> {
  const r = await covalentGet<BalancesResponse>(
    `/${SOLANA_CHAIN_ID}/address/${wallet}/balances_v2/?nft=false`
  );
  if (!r.ok) return r;
  const balances: PortfolioBalance[] = (r.data.items ?? [])
    .map((it) => {
      const decimals = it.contract_decimals ?? 0;
      const raw = it.balance ?? "0";
      const balance = Number(raw) / 10 ** decimals;
      return {
        ticker: it.contract_ticker_symbol ?? "?",
        balance,
        quoteUsd: it.quote ?? 0,
      };
    })
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.quoteUsd - a.quoteUsd)
    .slice(0, 6);
  const total = balances.reduce((acc, b) => acc + b.quoteUsd, 0);
  return { ok: true, total, balances };
}
