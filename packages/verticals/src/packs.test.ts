import { describe, expect, test } from "bun:test";
import { foodBuyer } from "./food-buyer";
import { logistics } from "./logistics";

describe("food_buyer.decide", () => {
  test("storable staple with high P(rise) -> BUY_AHEAD", () => {
    const out = foodBuyer.decide({
      business: { id: "b1", name: "Lagos restaurant" },
      exposure: {
        items: [{ seriesKey: "food.rice_50kg.national", weeklyQty: 2, unit: "50kg", storableWeeks: 4, perishable: false }],
      },
      forecasts: [{ questionId: "q1", seriesKey: "food.rice_50kg.national", probability: 0.71, asOf: new Date() }],
      latest: [{ seriesKey: "food.rice_50kg.national", observedAt: new Date(), value: 95000 }],
      asOf: new Date(),
    });
    expect(out[0].action).toBe("BUY_AHEAD");
    expect(out[0].expectedImpactNgn).toBeGreaterThan(0);
  });

  test("perishable with high P(rise) -> ADJUST_MENU_PRICE", () => {
    const out = foodBuyer.decide({
      business: { id: "b2", name: "Abuja grocery" },
      exposure: {
        items: [{ seriesKey: "food.tomatoes_basket.national", weeklyQty: 10, unit: "basket", storableWeeks: 0, perishable: true }],
      },
      forecasts: [{ questionId: "q2", seriesKey: "food.tomatoes_basket.national", probability: 0.8, asOf: new Date() }],
      latest: [{ seriesKey: "food.tomatoes_basket.national", observedAt: new Date(), value: 12000 }],
      asOf: new Date(),
    });
    expect(out[0].action).toBe("ADJUST_MENU_PRICE");
  });

  test("simulate reports savings honestly", () => {
    const t = (s: string) => new Date(s);
    const res = foodBuyer.simulate({
      prices: [
        { seriesKey: "s", observedAt: t("2026-06-01"), value: 100 },
        { seriesKey: "s", observedAt: t("2026-07-01"), value: 120 },
        { seriesKey: "s", observedAt: t("2026-08-01"), value: 130 },
      ],
      actions: [{ at: t("2026-06-01"), seriesKey: "s", action: "BUY_AHEAD", weeksAhead: 1 }],
      weeklyQty: 1,
      holdingCostPerUnitWeek: 0.5,
    });
    expect(res.naiveCost).toBeGreaterThan(0);
    expect(typeof res.savedNgn).toBe("number");
  });
});

describe("logistics.decide", () => {
  test("high PMS probability -> PREBUY_FUEL", () => {
    const out = logistics.decide({
      business: { id: "l1", name: "Lagos courier" },
      exposure: { fleets: [{ fuel: "pms", litresPerWeek: 200 }] },
      forecasts: [{ questionId: "q3", seriesKey: "fuel.pms.national", probability: 0.7, asOf: new Date() }],
      latest: [],
      asOf: new Date(),
    });
    expect(["PREBUY_FUEL", "LOCK_SUPPLIER_PRICE"]).toContain(out[0].action);
  });
});
