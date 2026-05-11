import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

// Zerion CLI binary, installed as a local dep.
// Server-only.
const ZERION_BIN = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  "zerion"
);

export function zerionConfigured(): boolean {
  return !!process.env.ZERION_API_KEY;
}

interface ZerionResult<T> {
  ok: true;
  data: T;
}

interface ZerionError {
  ok: false;
  error: string;
  stderr?: string;
}

async function zerionExec<T>(
  args: string[]
): Promise<ZerionResult<T> | ZerionError> {
  if (!zerionConfigured()) {
    return { ok: false, error: "ZERION_API_KEY not set" };
  }
  try {
    const { stdout, stderr } = await execFileAsync(ZERION_BIN, args, {
      env: { ...process.env, ZERION_API_KEY: process.env.ZERION_API_KEY },
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (stderr && !stdout) {
      return { ok: false, error: "zerion-cli emitted only stderr", stderr };
    }
    try {
      const data = JSON.parse(stdout) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: "Failed to parse zerion-cli JSON output" };
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================
// Read paths — work without a managed wallet, only need the API key.
// ============================================================

export interface ZerionPortfolio {
  total: { usd_value: number };
  // shape simplified — full schema documented in Zerion API docs
  [key: string]: unknown;
}

export async function fetchPortfolio(
  address: string
): Promise<ZerionResult<ZerionPortfolio> | ZerionError> {
  return zerionExec(["portfolio", address]);
}

export interface ZerionAnalysis {
  address: string;
  portfolio: unknown;
  positions: unknown;
  history: unknown;
  pnl: unknown;
}

export async function analyzeWallet(
  address: string
): Promise<ZerionResult<ZerionAnalysis> | ZerionError> {
  return zerionExec(["analyze", address]);
}

// ============================================================
// Write paths — require a Zerion managed wallet imported with the treasury secret.
// These power the activation handler when Zerion CLI runtime is enabled.
//
// Setup (one-time, manual):
//   zerion wallet import --name shopier-treasury --sol-key
//   (paste the TREASURY_SECRET_KEY bytes when prompted)
//
//   ZERION_API_KEY=... must be set in the env.
//
// Once configured, the activation handler can replace its raw web3.js calls with
// a sequence of `zerion send` / `zerion sign-message` invocations, gaining:
//   - Agent-token + policy scoping (the treasury wallet's ability to spend is
//     bounded by a Zerion policy: chain whitelist, recipient whitelist, daily cap)
//   - Structured JSON output for downstream observability
//   - Drop-in support for the Zerion API's x402 payment layer
// ============================================================

const TREASURY_WALLET_NAME = "shopier-treasury";

/**
 * Send USDC from the treasury wallet on Solana to a destination address.
 * Requires the treasury keypair to be imported into Zerion CLI under TREASURY_WALLET_NAME.
 */
export async function treasurySendUsdc(
  toAddress: string,
  amount: number
): Promise<ZerionResult<{ signature: string }> | ZerionError> {
  return zerionExec([
    "send",
    "solana",
    String(amount),
    "USDC",
    toAddress,
    "--wallet",
    TREASURY_WALLET_NAME,
  ]);
}

export const ZERION_TREASURY_WALLET_NAME = TREASURY_WALLET_NAME;
