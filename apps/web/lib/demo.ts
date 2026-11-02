export type Action = {
  id: string
  item: string
  market: string
  action: "BUY_AHEAD" | "BUY_AS_USUAL" | "DELAY_PURCHASE" | "ADJUST_MENU_PRICE"
  probability: number
  headline: string
  detail: string
  expectedImpactNgn: number
  confidence: "low" | "medium" | "high"
  formula: string
  evidence: { label: string; source: string }[]
  agents: { name: string; probability: number; note: string }[]
}

export const businesses = [
  {
    id: "b1",
    name: "Mama Put Restaurant",
    place: "Surulere, Lagos",
    items: "Rice 50kg · Beans · Oil 5L",
  },
  {
    id: "b2",
    name: "Abuja Grocery Delivery",
    place: "Wuse Market, Abuja",
    items: "Garri · Tomatoes · Onions",
  },
] as const

export const actions: Action[] = [
  {
    id: "a1",
    item: "Rice 50kg",
    market: "Mile 12 Market",
    action: "BUY_AHEAD",
    probability: 0.71,
    headline: "Rice likely to rise 10–15% within 3 weeks. Buy 2 weeks ahead.",
    detail:
      "Three agents agree momentum is up and base rates support it. You store up to 4 weeks, so 2 weeks ahead fits your storage.",
    expectedImpactNgn: 38000,
    confidence: "high",
    formula: "2 wks × 2 bags/wk × ₦95,000 × 12% − 1% holding = ₦38,000",
    evidence: [
      { label: "NBS Price Watch: rice +4.1% MoM", source: "NBS" },
      {
        label: "Radio clip: Mile 12 traders cite transport costs",
        source: "Radio",
      },
      { label: "FX: NGN/USD official +1.8% this month", source: "FX" },
    ],
    agents: [
      {
        name: "Base rate",
        probability: 0.66,
        note: "Moves this size happened 1 in 3 releases.",
      },
      {
        name: "Trend",
        probability: 0.78,
        note: "Two rising releases in a row.",
      },
      {
        name: "Contrarian",
        probability: 0.62,
        note: "Harvest could soften it, but transport dominates.",
      },
    ],
  },
  {
    id: "a2",
    item: "Tomatoes (basket)",
    market: "Mile 12 Market",
    action: "ADJUST_MENU_PRICE",
    probability: 0.68,
    headline:
      "Tomatoes likely to spike. You can't stock up — plan a menu price tweak.",
    detail:
      "Perishable, so buying ahead is not an option. A small temporary price adjustment protects margin.",
    expectedImpactNgn: 12500,
    confidence: "medium",
    formula: "Perishable rule: P(rise) ≥ 60% → ADJUST_MENU_PRICE",
    evidence: [
      {
        label: "Open-Meteo: heavy rain in producing states",
        source: "Weather",
      },
      { label: "Nairametrics: tomato prices climbing", source: "Press" },
    ],
    agents: [
      {
        name: "Base rate",
        probability: 0.6,
        note: "Rain-season spikes are common.",
      },
      {
        name: "Trend",
        probability: 0.74,
        note: "Wholesale quotes up two weeks running.",
      },
      {
        name: "Contrarian",
        probability: 0.61,
        note: "Dry week could reverse it fast.",
      },
    ],
  },
  {
    id: "a3",
    item: "Vegetable oil 5L",
    market: "Wuse Market",
    action: "BUY_AS_USUAL",
    probability: 0.48,
    headline: "Oil looks flat. Buy as usual, no need to lock cash in.",
    detail:
      "Signals are mixed and near 50%. Usual weekly quantity is the right call.",
    expectedImpactNgn: 0,
    confidence: "low",
    formula: "No action: probability inside 40–60% band",
    evidence: [{ label: "NBS Price Watch: oil flat MoM", source: "NBS" }],
    agents: [
      { name: "Base rate", probability: 0.5, note: "Flat is the base rate." },
      { name: "Trend", probability: 0.46, note: "No clear momentum." },
      {
        name: "Contrarian",
        probability: 0.49,
        note: "FX pass-through not showing yet.",
      },
    ],
  },
]

export const forecasts = [
  {
    q: "Will rice 50kg rise >10% MoM next NBS release?",
    p: 0.71,
    change: 0.06,
    days: 21,
    tag: "food",
  },
  {
    q: "Will PMS national average exceed ₦1,100/litre?",
    p: 0.64,
    change: -0.02,
    days: 18,
    tag: "fuel",
  },
  {
    q: "Will beans 50kg rise >8% MoM next release?",
    p: 0.44,
    change: 0.03,
    days: 21,
    tag: "food",
  },
  {
    q: "Will NGN/USD stay above 1,500 at month end?",
    p: 0.58,
    change: 0.01,
    days: 12,
    tag: "fx",
  },
]

export const backtest = {
  window: "Jun – Sep 2026",
  savedNgn: 214000,
  savedPct: 6.8,
  kasuwaBrier: 0.168,
  baseline50: 0.25,
  persistence: 0.211,
  perAgent: [
    { name: "Aggregate", brier: 0.168 },
    { name: "Base rate", brier: 0.184 },
    { name: "Trend", brier: 0.179 },
    { name: "Contrarian", brier: 0.196 },
  ],
  calibration: [
    { bin: "0–20%", predicted: 12, observed: 15, count: 8 },
    { bin: "20–40%", predicted: 31, observed: 28, count: 11 },
    { bin: "40–60%", predicted: 51, observed: 55, count: 14 },
    { bin: "60–80%", predicted: 69, observed: 64, count: 12 },
    { bin: "80–100%", predicted: 86, observed: 82, count: 6 },
  ],
  hits: "Called the July rice jump 3 weeks early (71%, resolved true).",
  miss: "Missed the August tomato drop after a dry spell (68% rise, resolved false).",
}

export const trust = {
  agents: [
    { name: "Trend", weight: 0.42 },
    { name: "Base rate", weight: 0.33 },
    { name: "Contrarian", weight: 0.25 },
  ],
  sources: [
    { name: "NBS Price Watch", weight: 0.9 },
    { name: "Radio transcripts", weight: 0.74 },
    { name: "BusinessDay RSS", weight: 0.61 },
  ],
  excluded: 128,
}

export function naira(n: number): string {
  return "₦" + n.toLocaleString("en-NG")
}
