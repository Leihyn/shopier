import type {
  FulfillmentBridge,
  FulfillmentRequest,
  FulfillmentResult,
} from "./types";

/**
 * Crossmint Headless Checkout — USDC-funded virtual Visa, places order on
 * user's behalf at any merchant URL.
 *
 * v1 integration shape (when CROSSMINT_API_KEY is set):
 *   1. POST https://www.crossmint.com/api/2022-06-09/orders
 *      { lineItems: [{ productLocator: { url } }],
 *        recipient: { ... },
 *        payment: { method: "solana", currency: "USDC", payerAddress } }
 *   2. Response includes a payment intent + escrow address
 *   3. User signs USDC transfer to escrow
 *   4. Crossmint converts USDC to fiat, places order at merchant
 *   5. Webhook fires on order confirmation + shipment
 *
 * Crossmint serves globally; used as the alternative adapter when Raenest
 * doesn't apply (e.g. user is in a region Raenest doesn't serve).
 */
export class CrossmintBridge implements FulfillmentBridge {
  name = "crossmint";

  configured(): boolean {
    return !!process.env.CROSSMINT_API_KEY;
  }

  async supports(req: FulfillmentRequest): Promise<boolean> {
    return req.amountUsd > 0;
  }

  async fulfill(req: FulfillmentRequest): Promise<FulfillmentResult> {
    if (!this.configured()) {
      return {
        mode: "deposit",
        message:
          `[v1 stub] Crossmint Headless Checkout: USDC → escrow → virtual card buys ` +
          `${req.itemTitle} at the merchant. Real integration ships when CROSSMINT_API_KEY is configured.`,
        via: this.name,
      };
    }

    throw new Error(
      "CrossmintBridge.fulfill: real API integration pending. " +
        "Set CROSSMINT_API_KEY only when the v1 wiring lands."
    );
  }
}
