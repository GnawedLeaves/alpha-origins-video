import "server-only";
import { requireEnv } from "@/lib/env";
import { FAL_MODELS, getFalModel, resolveFalEndpoint } from "./models";

export type PriceUnit = "second" | "video";

export interface ModelPrice {
  usd: number;
  unit: PriceUnit;
  // Where the number came from, shown next to it on the usage page.
  source: "fal" | "estimate";
}

// Fallback list prices (USD) used when fal.ai's pricing API can't be reached. These are
// estimates from fal.ai's public model pages and WILL drift: check fal.ai/pricing (or the model's
// page on fal.ai) and update them here. `null` = unknown, shown as "no price set".
const FALLBACK_PRICES: Record<string, { usd: number; unit: PriceUnit } | null> = {
  "kling-2.0": { usd: 0.28, unit: "second" },
  "kling-2.0-image": { usd: 0.28, unit: "second" },
  "ltx-video": { usd: 0.02, unit: "video" },
  "minimax-hailuo": { usd: 0.5, unit: "video" },
  "kling-o1-reference": null,
  "kling-o1-reference-pro": null,
};

// fal.ai's pricing API returns one price per endpoint. The response is read defensively: any
// shape we don't recognise just means "use the fallback list".
const PRICING_URL = "https://api.fal.ai/v1/models/pricing";
const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; prices: Map<string, { usd: number; unit: PriceUnit }> } | null = null;

function toUnit(raw: unknown): PriceUnit | null {
  const u = String(raw ?? "").toLowerCase();
  if (u.startsWith("second") || u === "s" || u === "sec") return "second";
  if (["video", "videos", "request", "requests", "generation", "output"].includes(u)) return "video";
  return null;
}

async function fetchFalPrices(endpoints: string[]) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.prices;
  const prices = new Map<string, { usd: number; unit: PriceUnit }>();
  try {
    const url = new URL(PRICING_URL);
    for (const e of endpoints) url.searchParams.append("endpoint_id", e);
    const res = await fetch(url, {
      headers: { Authorization: `Key ${requireEnv("FAL_KEY", process.env.FAL_KEY)}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = (await res.json()) as { prices?: unknown };
      const list = Array.isArray(body?.prices) ? body.prices : [];
      for (const p of list as Record<string, unknown>[]) {
        const unit = toUnit(p.unit);
        const usd = Number(p.unit_price);
        const currency = String(p.currency ?? "USD").toUpperCase();
        if (typeof p.endpoint_id === "string" && unit && Number.isFinite(usd) && currency === "USD") {
          prices.set(p.endpoint_id, { usd, unit });
        }
      }
    }
  } catch (err) {
    console.warn("fal.ai pricing lookup failed, using built-in estimates:", (err as Error).message);
  }
  cache = { at: Date.now(), prices };
  return prices;
}

// Price per model id: fal.ai's live price when available, else the fallback estimate, else null.
export async function getModelPrices(): Promise<Record<string, ModelPrice | null>> {
  const endpointFor = (id: string, withImage: boolean) =>
    resolveFalEndpoint(getFalModel(id), withImage);
  const endpoints = [...new Set(FAL_MODELS.flatMap((m) => [endpointFor(m.id, false), endpointFor(m.id, true)]))];
  const live = await fetchFalPrices(endpoints);

  const result: Record<string, ModelPrice | null> = {};
  for (const m of FAL_MODELS) {
    const fromFal = live.get(endpointFor(m.id, m.requiresImage ?? false));
    if (fromFal) result[m.id] = { ...fromFal, source: "fal" };
    else {
      const fallback = FALLBACK_PRICES[m.id];
      result[m.id] = fallback ? { ...fallback, source: "estimate" } : null;
    }
  }
  return result;
}

export function costOf(price: ModelPrice | null | undefined, seconds: number) {
  if (!price) return null;
  return price.unit === "second" ? price.usd * seconds : price.usd;
}
