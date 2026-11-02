import { PrismaClient } from "@prisma/client";
import type { LlmDb } from "@kasuwa/llm";

const prisma = new PrismaClient();

export const llmStore: LlmDb = {
  async findCache(hash) {
    const row = await prisma.llmCache.findUnique({ where: { hash } });
    return row ? { response: row.response } : null;
  },
  async saveCache(hash, model, response) {
    await prisma.llmCache.upsert({
      where: { hash },
      update: { response },
      create: { hash, model, response },
    });
  },
  async logCall(row) {
    await prisma.llmCall.create({ data: row });
  },
  async totalSpend() {
    const agg = await prisma.llmCall.aggregate({
      _sum: { costUsd: true },
      where: { cached: false },
    });
    return agg._sum.costUsd ?? 0;
  },
};
