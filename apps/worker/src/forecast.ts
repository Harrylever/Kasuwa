import { aggregateLogOdds, clampProbability } from "@kasuwa/core";
import { Schemas, structuredCall } from "@kasuwa/llm";
import { llmStore, prisma } from "@kasuwa/db";
import { foodBuyer } from "@kasuwa/verticals";

const AGENTS = [
  {
    id: "base_rate",
    system: "You are a base-rate analyst. Given the price history and evidence, estimate how often a move this size happened historically. Reply with JSON only: {probability, rationale, evidenceIds, abstain}.",
  },
  {
    id: "trend",
    system: "You are a trend extrapolator. Given the price history and evidence, judge where momentum points. Reply with JSON only: {probability, rationale, evidenceIds, abstain}.",
  },
  {
    id: "contrarian",
    system: "You are a contrarian risk analyst. Given the price history and evidence, argue what would make the obvious answer wrong, then give your probability. Reply with JSON only: {probability, rationale, evidenceIds, abstain}.",
  },
];

export async function forecastOpen(asOf = new Date()): Promise<void> {
  const questions = await prisma.question.findMany({ where: { status: "open" } });
  for (const q of questions) {
    const points = await prisma.indicatorPoint.findMany({
      where: { series: { key: q.seriesKey }, observedAt: { lte: asOf } },
      orderBy: { observedAt: "asc" },
      take: 24,
    });
    const evidence = await prisma.rawItem.findMany({
      where: {
        excluded: false,
        publishedAt: { lte: asOf },
        category: { in: ["food", "fuel", "macro", "weather", "fx", "logistics"] },
      },
      orderBy: { publishedAt: "desc" },
      take: 15,
    });
    const history = points.map((p) => `${p.observedAt.toISOString().slice(0, 7)}: ${p.value}`).join("\n");
    const evText = evidence.map((e) => `- [${e.id}] ${e.title}`).join("\n");
    const user = `Question: ${q.text}\nResolve by: ${q.resolveAt.toISOString().slice(0, 10)}\n\nPrice history:\n${history || "(no history)"}\n\nEvidence (cite ids, only these exist):\n${evText || "(no evidence)"}`;

    const probs: number[] = [];
    const weights: number[] = [];
    for (const agent of AGENTS) {
      const out = await structuredCall(llmStore, Schemas.ForecastSchema, {
        system: agent.system,
        user,
        purpose: `forecast-${agent.id}`,
        modelEnv: "MODEL_FORECAST",
      });
      const validEvidence = out.evidenceIds.filter((id) => evidence.some((e) => e.id === id));
      const abstain = out.abstain || validEvidence.length < 2;
      const p = abstain ? 0.5 : clampProbability(out.probability);
      await prisma.forecast.create({
        data: {
          questionId: q.id,
          agent: agent.id,
          probability: p,
          rationale: out.rationale.slice(0, 2000),
          evidenceIds: JSON.stringify(validEvidence),
          asOf,
          abstained: abstain,
        },
      });
      console.log(`[forecast] ${q.id.slice(0, 8)} ${agent.id}: ${p}${abstain ? " (abstain)" : ""}`);
      if (!abstain) {
        probs.push(p);
        weights.push(1);
      }
    }
    const agg = aggregateLogOdds(probs, weights);
    await prisma.aggregateForecast.create({
      data: { questionId: q.id, probability: agg.probability, asOf, weightsSnapshot: JSON.stringify({ agents: AGENTS.map((a) => a.id), weights }) },
    });
    console.log(`[forecast] aggregate: ${agg.probability.toFixed(3)}`);
  }
}

export async function recommendAll(asOf = new Date()): Promise<void> {
  const businesses = await prisma.business.findMany({ include: { exposures: true } });
  for (const b of businesses) {
    if (b.vertical !== "food_buyer") continue;
    const exposure = JSON.parse(b.exposures[0]?.data ?? '{"items":[]}');
    const aggs = await prisma.aggregateForecast.findMany({ orderBy: { asOf: "desc" }, take: 20 });
    const questions = await prisma.question.findMany({ where: { id: { in: aggs.map((a) => a.questionId) } } });
    const qById = new Map(questions.map((q) => [q.id, q]));
    const forecasts = aggs.map((a) => ({
      questionId: a.questionId,
      seriesKey: qById.get(a.questionId)?.seriesKey ?? "",
      probability: a.probability,
      asOf,
    }));
    const seriesKeys = [...new Set(forecasts.map((f) => f.seriesKey).filter(Boolean))];
    const latest = await prisma.indicatorPoint.findMany({
      where: { series: { key: { in: seriesKeys } } },
      orderBy: { observedAt: "desc" },
    });
    const latestBySeries = new Map<string, { seriesKey: string; observedAt: Date; value: number }>();
    for (const p of latest) {
      const s = await prisma.indicatorSeries.findUnique({ where: { id: p.seriesId } });
      if (s && !latestBySeries.has(s.key)) latestBySeries.set(s.key, { seriesKey: s.key, observedAt: p.observedAt, value: p.value });
    }
    const drafts = foodBuyer.decide({
      business: { id: b.id, name: b.name },
      exposure,
      forecasts,
      latest: [...latestBySeries.values()],
      asOf,
    });
    for (const d of drafts) {
      await prisma.recommendation.create({
        data: {
          businessId: b.id,
          questionIds: JSON.stringify(d.questionIds),
          action: d.action,
          headline: `${d.seriesKey}: ${d.action.replaceAll("_", " ")}`,
          detail: `P=${(forecasts.find((f) => f.seriesKey === d.seriesKey)?.probability ?? 0.5).toFixed(2)}. Formula: quantity × expected move − holding cost.`,
          expectedImpactNgn: d.expectedImpactNgn,
          confidence: d.confidence,
          evidenceIds: JSON.stringify(d.evidenceIds),
          asOf,
        },
      });
    }
    console.log(`[recommend] ${b.name}: ${drafts.map((d) => d.action).join(", ")}`);
  }
}

if (import.meta.main) {
  const asOf = new Date();
  await forecastOpen(asOf).then(() => recommendAll(asOf)).finally(() => prisma.$disconnect());
  process.exit(0);
}
