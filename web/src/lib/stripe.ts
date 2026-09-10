import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazily construct the Stripe client so that importing this module
 * (e.g. during `next build` page-data collection) does not require
 * STRIPE_SECRET_KEY to be present. The key is only needed at request time.
 */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    client = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return client;
}

/** True when the configured key is a live-mode key (sk_live_...). */
export function isStripeLiveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY?.trim() || "").startsWith("sk_live_");
}
