/**
 * Fulfillment bridge interface.
 *
 * Bridges connect Shopier's on-chain USDC settlement to fiat-rail merchants.
 * Each adapter implements the same surface: take a purchase intent + the user's
 * USDC funding source, return either an order confirmation (full integration)
 * or a deposit instruction (consumer-flow handoff). v0 ships only the stubs;
 * v1 ships at least one real adapter.
 *
 * Multiple adapters can coexist — Shopier picks per market based on user
 * geography, supported merchants, and configuration.
 */

export type FulfillmentMode =
  | "direct" // bridge places the order on the user's behalf; we get a confirmation
  | "deposit" // bridge gives us a deposit address; user separately funds and uses card themselves
  | "redirect"; // bridge gives us a checkout URL to send the user to

export interface FulfillmentRequest {
  /** Item URL at the merchant — e.g. https://www.nordstrom.com/s/... */
  merchantUrl: string;
  /** Display title for receipts and emails */
  itemTitle: string;
  /** USD-denominated amount, will be debited from user's USDC */
  amountUsd: number;
  /** User's wallet pubkey — funding source on Solana */
  userPubkey: string;
  /** Optional shipping recipient (only "direct" mode uses this) */
  recipient?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    countryIso2: string;
    email?: string;
    phone?: string;
  };
  /** Optional metadata that surfaces in the bridge's records */
  metadata?: Record<string, string>;
}

export interface FulfillmentResult {
  mode: FulfillmentMode;
  /** Bridge-specific order id when available */
  orderId?: string;
  /** Where to send the USDC deposit (deposit/redirect modes) */
  depositAddress?: string;
  /** Hosted checkout URL (redirect mode) */
  checkoutUrl?: string;
  /** Estimated ship date (direct mode) */
  estShipBy?: string;
  /** Status message for the activity panel */
  message: string;
  /** Bridge name — e.g. "raenest", "crossmint" — for analytics */
  via: string;
}

export interface FulfillmentBridge {
  /** Display name */
  name: string;
  /** Whether this adapter is configured (env keys present, etc.) */
  configured(): boolean;
  /** Whether this adapter wants to handle the given request */
  supports(req: FulfillmentRequest): Promise<boolean>;
  /** Place the order. Throws on failure. */
  fulfill(req: FulfillmentRequest): Promise<FulfillmentResult>;
}
