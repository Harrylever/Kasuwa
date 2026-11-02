import { prisma } from "@kasuwa/db";
import { foodBuyer, logistics } from "@kasuwa/verticals";

const FX_NAMES: Record<string, string> = {
  "food.rice_50kg.national": "Rice 50kg (national average)",
  "food.beans_50kg.national": "Beans 50kg (national average)",
  "food.garri_50kg.national": "Garri 50kg (national average)",
  "food.oil_5l.national": "Vegetable oil 5L (national average)",
  "food.tomatoes_basket.national": "Tomatoes basket (national average)",
  "fuel.pms.national": "PMS petrol (national average)",
  "fuel.ago.national": "AGO diesel (national average)",
  "fx.ngn_usd.official": "NGN/USD official rate",
};

export async function generateQuestions(asOf = new Date()): Promise<number> {
  const packs = [foodBuyer, logistics];
  const seen = new Set<string>();
  let created = 0;
  for (const pack of packs) {
    for (const t of pack.questionTemplates) {
      const dedupe = `${t.kind}:${t.seriesKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const series = await prisma.indicatorSeries.findUnique({ where: { key: t.seriesKey } });
      if (!series) continue;
      const latest = await prisma.indicatorPoint.findFirst({
        where: { seriesId: series.id, observedAt: { lte: asOf } },
        orderBy: { observedAt: "desc" },
      });
      if (!latest) {
        console.log(`[questions] no data for ${t.seriesKey}, skipping`);
        continue;
      }
      const label = FX_NAMES[t.seriesKey] ?? t.seriesKey;
      let text = "";
      let threshold = 0;
      let operator = "gt";
      if (t.kind === "PRICE_RELEASE") {
        threshold = Math.round(latest.value * 1.1);
        text = `Will the next NBS ${label} exceed ₦${threshold.toLocaleString("en-NG")}?`;
      } else if (t.kind === "PCT_CHANGE") {
        threshold = 10;
        text = `Will ${label} rise more than 10% month-over-month in the next release?`;
      } else {
        threshold = Math.round(latest.value * 1.05);
        text = `Will ${label} be above ${threshold} at month end?`;
      }
      const exists = await prisma.question.findFirst({
        where: { templateId: t.id, status: "open" },
      });
      if (exists) continue;
      await prisma.question.create({
        data: {
          vertical: pack.id,
          templateId: t.id,
          text,
          type: t.kind,
          seriesKey: t.seriesKey,
          operator,
          threshold,
          resolveAt: new Date("2026-12-15T00:00:00Z"),
          createdAsOf: asOf,
          status: "open",
        },
      });
      created++;
    }
  }
  console.log(`[questions] +${created} open questions`);
  return created;
}

if (import.meta.main) {
  await generateQuestions().finally(() => prisma.$disconnect());
  process.exit(0);
}
