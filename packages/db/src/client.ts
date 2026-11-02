export { PrismaClient } from "@prisma/client";
import { PrismaClient as PC } from "@prisma/client";

export const prisma = new PC();

export async function getPrisma(): Promise<unknown> {
  return prisma;
}

export function requireAsOf(asOf: Date | undefined, queryName: string): Date {
  if (!asOf) throw new Error(`[leakage-guard] ${queryName} requires asOf`);
  return asOf;
}
