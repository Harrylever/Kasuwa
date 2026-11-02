import { z } from "zod";

export type Category = "fx" | "fuel" | "food" | "logistics" | "weather" | "macro";

export interface SeriesDef {
  key: string;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  source: string;
}

export interface QuestionTemplate {
  id: string;
  kind: "FX_THRESHOLD" | "PRICE_RELEASE" | "PCT_CHANGE";
  seriesKey: string;
}

export interface AggregateForecastLike {
  questionId: string;
  seriesKey: string;
  probability: number;
  asOf: Date;
}

export interface PricePointLike {
  seriesKey: string;
  observedAt: Date;
  value: number;
}

export interface RecommendationDraft {
  seriesKey: string;
  action: string;
  questionIds: string[];
  expectedImpactNgn: number;
  confidence: "low" | "medium" | "high";
  evidenceIds: string[];
}

export interface DecideInput {
  business: { id: string; name: string };
  exposure: unknown;
  forecasts: AggregateForecastLike[];
  latest: PricePointLike[];
  asOf: Date;
}

export interface BacktestSimInput {
  prices: PricePointLike[];
  actions: { at: Date; seriesKey: string; action: string; weeksAhead: number }[];
  weeklyQty: number;
  holdingCostPerUnitWeek: number;
}

export interface BacktestSimResult {
  naiveCost: number;
  kasuwaCost: number;
  savedNgn: number;
  savedPct: number;
}

export interface VerticalPack {
  id: "food_buyer" | "logistics";
  name: string;
  categories: Category[];
  series: SeriesDef[];
  questionTemplates: QuestionTemplate[];
  exposureSchema: z.ZodSchema;
  actions: readonly string[];
  decide(input: DecideInput): RecommendationDraft[];
  simulate(input: BacktestSimInput): BacktestSimResult;
}
