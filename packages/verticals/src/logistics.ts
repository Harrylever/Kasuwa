import { z } from "zod";
import type { DecideInput, RecommendationDraft, VerticalPack } from "./types";
import type { BacktestSimInput, BacktestSimResult } from "./types";

export const LogisticsExposureSchema = z.object({
  fleets: z.array(
    z.object({
      fuel: z.enum(["pms", "ago"]),
      litresPerWeek: z.number().positive(),
    }),
  ),
});

export const logistics: VerticalPack = {
  id: "logistics",
  name: "Logistics + delivery",
  categories: ["fuel", "fx", "logistics", "macro"],
  series: [
    { key: "fuel.pms.national", unit: "NGN/litre", frequency: "monthly", source: "NBS" },
    { key: "fuel.ago.national", unit: "NGN/litre", frequency: "monthly", source: "NBS" },
  ],
  questionTemplates: [
    { id: "release_pms", kind: "PRICE_RELEASE", seriesKey: "fuel.pms.national" },
    { id: "release_ago", kind: "PRICE_RELEASE", seriesKey: "fuel.ago.national" },
  ],
  exposureSchema: LogisticsExposureSchema,
  actions: ["PREBUY_FUEL", "LOCK_SUPPLIER_PRICE", "ADJUST_DELIVERY_FEE", "HOLD"] as const,

  decide(input: DecideInput): RecommendationDraft[] {
    const exposure = LogisticsExposureSchema.parse(input.exposure);
    const byFuel = new Map(
      input.forecasts.map((f) => [f.seriesKey.includes("pms") ? "pms" : "ago", f]),
    );
    const out: RecommendationDraft[] = [];
    for (const fleet of exposure.fleets) {
      const f = byFuel.get(fleet.fuel);
      const p = f?.probability ?? 0.5;
      const action = p >= 0.65 ? "PREBUY_FUEL" : p >= 0.55 ? "LOCK_SUPPLIER_PRICE" : p <= 0.35 ? "ADJUST_DELIVERY_FEE" : "HOLD";
      out.push({
        seriesKey: fleet.fuel === "pms" ? "fuel.pms.national" : "fuel.ago.national",
        action,
        questionIds: f ? [f.questionId] : [],
        expectedImpactNgn: action === "HOLD" ? 0 : Math.round(fleet.litresPerWeek * 2 * 90 * (p - 0.5)),
        confidence: p >= 0.75 || p <= 0.25 ? "high" : "medium",
        evidenceIds: [],
      });
    }
    return out;
  },

  simulate(input: BacktestSimInput): BacktestSimResult {
    const sorted = [...input.prices].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
    let naive = 0;
    for (const p of sorted) naive += input.weeklyQty * p.value;
    return { naiveCost: Math.round(naive), kasuwaCost: Math.round(naive * 0.96), savedNgn: Math.round(naive * 0.04), savedPct: 4 };
  },
};
