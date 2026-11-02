import { z } from "zod";
import { keywordGuard, structuredCall } from "@kasuwa/llm";
import { llmStore, prisma } from "@kasuwa/db";

const BatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      category: z.enum(["fx", "fuel", "food", "logistics", "weather", "macro", "excluded"]),
      excludedReason: z.string().optional(),
      region: z.string().default("Nigeria"),
      summary: z.string().default(""),
      severity: z.union([z.number(), z.string()]).default(3),
    }),
  ),
});

const SYSTEM = `Classify Nigerian market news items for a price-forecasting engine.
Categories: fx, fuel, food, logistics, weather, macro. Use "excluded" ONLY for
political/election/campaign, conflict/security/violence, or entirely irrelevant items.
Reply with JSON only: {"items": [{id, category, excludedReason?, region, summary, severity}]}.`;

export async function triagePending(batchSize = 10): Promise<{ triaged: number; excluded: number; llmCalls: number }> {
  const pending = await prisma.rawItem.findMany({ where: { triagedAt: null }, take: 200 });
  let triaged = 0;
  let excluded = 0;
  let llmCalls = 0;

  const needsLlm: typeof pending = [];
  for (const item of pending) {
    const guard = keywordGuard(`${item.title}\n${item.body.slice(0, 500)}`);
    if (guard.excluded) {
      await prisma.rawItem.update({
        where: { id: item.id },
        data: { category: "excluded", excluded: true, excludedReason: "political", severity: 1, triagedAt: new Date() },
      });
      triaged++;
      excluded++;
    } else {
      needsLlm.push(item);
    }
  }

  for (let i = 0; i < needsLlm.length; i += batchSize) {
    const batch = needsLlm.slice(i, i + batchSize);
    const user = batch
      .map((it, n) => `[${n}] id=${it.id}\nTitle: ${it.title}\n${it.body.slice(0, 600)}`)
      .join("\n\n");
    const out = await structuredCall(llmStore, BatchSchema, {
      system: SYSTEM,
      user,
      purpose: "triage",
      modelEnv: "MODEL_FORECAST", // fallback: open-weight partner creds pending
    });
    llmCalls++;
    const byId = new Map(out.items.map((o) => [o.id, o]));
    for (const [n, it] of batch.entries()) {
      const r = byId.get(it.id) ?? byId.get(String(n));
      if (!r) {
        console.warn(`[triage] no result for ${it.id}, leaving untriaged`);
        continue;
      }
      const sev = Math.min(5, Math.max(1, parseInt(String(r.severity), 10) || 3));
      const isExcluded = r.category === "excluded";
      const reason = (r.excludedReason ?? "").toLowerCase();
      const normalized = /polit|elect|campaign|party|vote|govern/.test(reason)
        ? "political"
        : /conflict|attack|kill|bandit|terror|milit|war|insecur|violence/.test(reason)
          ? "conflict"
          : "irrelevant";
      await prisma.rawItem.update({
        where: { id: it.id },
        data: {
          category: r.category,
          excluded: isExcluded,
          excludedReason: isExcluded ? normalized : undefined,
          severity: sev,
          triagedAt: new Date(),
        },
      });
      triaged++;
      if (isExcluded) excluded++;
    }
  }
  console.log(`[triage] triaged=${triaged} excluded=${excluded} llmCalls=${llmCalls}`);
  return { triaged, excluded, llmCalls };
}

if (import.meta.main) {
  await triagePending().finally(() => prisma.$disconnect());
  process.exit(0);
}
