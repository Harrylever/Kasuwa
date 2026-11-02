import { keywordGuard } from "@kasuwa/llm";
import { aggregateLogOdds, brier, clampProbability, logLoss, updateAgentTrust } from "@kasuwa/core";
import { packs } from "@kasuwa/verticals";

export const TRIAGE_EXCLUDED = "excluded" as const;

export function triageWithGuard(text: string, modelCategory: string): string {
  const guard = keywordGuard(text);
  if (guard.excluded) return TRIAGE_EXCLUDED;
  if (modelCategory === "excluded") return TRIAGE_EXCLUDED;
  return modelCategory;
}

export function validateForecast(
  probability: number,
  evidenceIds: string[],
  evidencePublishedAt: Map<string, Date>,
  asOf: Date,
): { ok: boolean; abstain: boolean; reason?: string } {
  for (const id of evidenceIds) {
    const pub = evidencePublishedAt.get(id);
    if (!pub) return { ok: false, abstain: true, reason: `unknown evidence ${id}` };
    if (pub.getTime() > asOf.getTime()) return { ok: false, abstain: true, reason: `future evidence ${id}` };
  }
  if (evidenceIds.length < 2) return { ok: true, abstain: true, reason: "fewer than 2 evidence items" };
  void clampProbability(probability);
  return { ok: true, abstain: false };
}

export async function runPipeline(asOf = new Date()): Promise<void> {
  console.log(`[worker] pipeline asOf=${asOf.toISOString()} packs=${Object.keys(packs).join(",")}`);
  // Day-1 wiring: ingest -> triage -> cluster -> questions -> forecast ->
  // aggregate -> resolve/score/trust -> recommendations. Each DB read filters
  // publishedAt <= asOf (see requireAsOf in @kasuwa/db).
  void aggregateLogOdds;
  void brier;
  void logLoss;
  void updateAgentTrust;
}

if (import.meta.main) {
  await runPipeline();
}
