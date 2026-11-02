import { z } from "zod";
import type {
  BacktestSimInput,
  BacktestSimResult,
  DecideInput,
  RecommendationDraft,
  VerticalPack,
} from "./types";

export const FoodExposureSchema = z.object({
  items: z.array(
    z.object({
      seriesKey: z.string(),
      weeklyQty: z.number().positive(),
      unit: z.string(),
      storableWeeks: z.number().min(0).max(12),
      perishable: z.boolean(),
    }),
  ),
});

type FoodExposure = z.infer<typeof FoodExposureSchema>;

export const foodBuyer: VerticalPack = {
  id: "food_buyer",
  name: "SME food buyers",
  categories: ["food", "fuel", "weather", "logistics", "macro", "fx"],
  series: [
    { key: "food.rice_50kg.national", unit: "NGN/50kg", frequency: "monthly", source: "NBS" },
    { key: "food.beans_50kg.national", unit: "NGN/50kg", frequency: "monthly", source: "NBS" },
    { key: "food.garri_50kg.national", unit: "NGN/50kg", frequency: "monthly", source: "NBS" },
    { key: "food.oil_5l.national", unit: "NGN/5L", frequency: "monthly", source: "NBS" },
    { key: "food.tomatoes_basket.national", unit: "NGN/basket", frequency: "monthly", source: "NBS" },
  ],
  questionTemplates: [
    { id: "pct_rice", kind: "PCT_CHANGE", seriesKey: "food.rice_50kg.national" },
    { id: "pct_beans", kind: "PCT_CHANGE", seriesKey: "food.beans_50kg.national" },
    { id: "release_garri", kind: "PRICE_RELEASE", seriesKey: "food.garri_50kg.national" },
  ],
  exposureSchema: FoodExposureSchema,
  actions: ["BUY_AHEAD", "BUY_AS_USUAL", "DELAY_PURCHASE", "ADJUST_MENU_PRICE"] as const,

  decide(input: DecideInput): RecommendationDraft[] {
    const exposure = FoodExposureSchema.parse(input.exposure) as FoodExposure;
    const bySeries = new Map(input.forecasts.map((f) => [f.seriesKey, f]));
    const priceBySeries = new Map(input.latest.map((p) => [p.seriesKey, p.value]));
    const out: RecommendationDraft[] = [];
    for (const item of exposure.items) {
      const f = bySeries.get(item.seriesKey);
      const price = priceBySeries.get(item.seriesKey) ?? 0;
      const p = f?.probability ?? 0.5;
      let action = "BUY_AS_USUAL";
      if (p >= 0.6 && !item.perishable && item.storableWeeks > 0) action = "BUY_AHEAD";
      else if (p <= 0.4 && !item.perishable) action = "DELAY_PURCHASE";
      else if (p >= 0.6 && item.perishable) action = "ADJUST_MENU_PRICE";
      const weeks = action === "BUY_AHEAD" ? Math.min(2, item.storableWeeks) : 0;
      const expectedMove = action === "BUY_AHEAD" ? 0.12 : action === "DELAY_PURCHASE" ? -0.08 : 0;
      const holding = weeks * item.weeklyQty * price * 0.01;
      const expectedImpactNgn = Math.max(
        0,
        Math.round(item.weeklyQty * weeks * price * Math.abs(expectedMove) - holding),
      );
      out.push({
        seriesKey: item.seriesKey,
        action,
        questionIds: f ? [f.questionId] : [],
        expectedImpactNgn: action === "BUY_AS_USUAL" ? 0 : expectedImpactNgn,
        confidence: p >= 0.75 || p <= 0.25 ? "high" : p >= 0.6 || p <= 0.4 ? "medium" : "low",
        evidenceIds: [],
      });
    }
    return out;
  },

  simulate(input: BacktestSimInput): BacktestSimResult {
    const sorted = [...input.prices].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
    let naiveCost = 0;
    for (const p of sorted) naiveCost += input.weeklyQty * p.value;
    let kasuwaCost = 0;
    let inventory = 0;
    const buys = new Map(input.actions.map((a) => [a.at.getTime(), a]));
    for (const p of sorted) {
      const act = buys.get(p.observedAt.getTime());
      const need = input.weeklyQty;
      if (act && act.weeksAhead > 0) {
        const buy = need * (1 + act.weeksAhead);
        kasuwaCost += buy * p.value + buy * input.holdingCostPerUnitWeek * act.weeksAhead;
        inventory += buy - need;
      } else if (inventory >= need) {
        inventory -= need;
        kasuwaCost += inventory >= 0 ? 0 : 0;
      } else {
        const fromStock = Math.min(inventory, need);
        inventory -= fromStock;
        kasuwaCost += (need - fromStock) * p.value;
      }
    }
    const savedNgn = Math.round(naiveCost - kasuwaCost);
    const savedPct = naiveCost > 0 ? (savedNgn / naiveCost) * 100 : 0;
    return { naiveCost: Math.round(naiveCost), kasuwaCost: Math.round(kasuwaCost), savedNgn, savedPct };
  },
};
