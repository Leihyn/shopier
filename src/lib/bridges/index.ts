import type {
  FulfillmentBridge,
  FulfillmentRequest,
  FulfillmentResult,
} from "./types";
import { RaenestBridge } from "./raenest";
import { CrossmintBridge } from "./crossmint";

const BRIDGES: FulfillmentBridge[] = [
  new RaenestBridge(),
  new CrossmintBridge(),
];

/**
 * Pick the first configured bridge that supports the request.
 * Returns null if no bridge is wired — caller falls through to v0 mock path.
 */
export async function pickBridge(
  req: FulfillmentRequest
): Promise<FulfillmentBridge | null> {
  for (const b of BRIDGES) {
    if (b.configured() && (await b.supports(req))) return b;
  }
  return null;
}

export type { FulfillmentBridge, FulfillmentRequest, FulfillmentResult };
export { RaenestBridge, CrossmintBridge };
