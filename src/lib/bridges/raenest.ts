import type {
  FulfillmentBridge,
  FulfillmentRequest,
  FulfillmentResult,
} from "./types";

/**
 * Raenest fulfillment bridge — USDC wallet → USD balance → virtual Visa card → fiat merchant.
 *
 * v1 integration shape (when API access is granted via the SuperteamNG x Raenest
 * partnership):
 *   1. POST /v1/deposits/create-instruction
 *      { user_id, amount_usd, asset: "USDC_SOL" } → { deposit_address }
 *   2. User signs USDC transfer to deposit_address — Shopier's purchase tx
 *   3. Raenest credits user's USD balance 1:1
 *   4. POST /v1/cards/issue-virtual or /v1/orders/place-via-merchant-url
 *      with the merchant URL — Raenest places the order using their virtual card
 *   5. Webhook fires on order confirmation + shipment
 *
 * Until API access is granted (consumer flow only):
 *   - Demo mode emits a `deposit` result instructing the user to fund their
 *     Raenest account manually, with the merchant URL surfaced for them to
 *     complete checkout themselves.
 *
 * Eligibility: Africa-licensed (CBN Nigeria + 190+ receive countries). The
 * adapter declines requests from regions Raenest doesn't serve, falling
 * through to other bridges.
 */
export class RaenestBridge implements FulfillmentBridge {
  name = "raenest";

  configured(): boolean {
    return !!process.env.RAENEST_API_KEY;
  }

  async supports(req: FulfillmentRequest): Promise<boolean> {
    // In production: check user's region against Raenest's supported list.
    // For v0 we accept anything if configured (or if demo mode).
    return req.amountUsd > 0;
  }

  async fulfill(req: FulfillmentRequest): Promise<FulfillmentResult> {
    if (!this.configured()) {
      // Demo mode — surface a meaningful instruction without a real API call.
      return {
        mode: "deposit",
        message:
          `[v1 stub] Raenest fulfillment: deposit $${req.amountUsd.toFixed(2)} USDC to your Raenest account, ` +
          `then complete checkout at ${req.merchantUrl} using your Raenest virtual card. ` +
          `Real integration ships when API access lands via the SuperteamNG × Raenest partnership.`,
        via: this.name,
      };
    }

    // v1: real API call goes here. Placeholder shape; replace with actual endpoint
    // documentation once the partnership conversation surfaces specifics.
    throw new Error(
      "RaenestBridge.fulfill: real API integration pending. " +
        "Set RAENEST_API_KEY only when the partnership API is wired in v1."
    );
  }
}
