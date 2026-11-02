import { prisma } from "@kasuwa/db";
import { triagePending } from "./triage";

// Clears the triage result on previously-excluded items so the (updated) guard + LLM judge them again.
const { count } = await prisma.rawItem.updateMany({
  where: { excluded: true },
  data: { excluded: false, excludedReason: null, category: null, triagedAt: null },
});
console.log(`[retriage] reset ${count} previously-excluded items`);
await triagePending().finally(() => prisma.$disconnect());
process.exit(0);
