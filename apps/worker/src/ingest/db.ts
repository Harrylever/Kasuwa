import { PrismaClient } from "@kasuwa/db";

export const prisma = new PrismaClient();

export async function upsertSource(name: string, kind: string, url?: string): Promise<string> {
  const existing = await prisma.source.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.source.create({ data: { name, kind, url } });
  return created.id;
}

export async function upsertRawItem(row: {
  sourceId: string;
  externalId: string;
  title: string;
  body: string;
  url?: string;
  publishedAt: Date;
  lang?: string;
}): Promise<boolean> {
  const existing = await prisma.rawItem.findUnique({
    where: { sourceId_externalId: { sourceId: row.sourceId, externalId: row.externalId } },
  });
  if (existing) return false;
  await prisma.rawItem.create({
    data: { ...row, lang: row.lang ?? "en", fetchedAt: new Date() },
  });
  return true;
}

export async function addIndicatorPoint(seriesKey: string, observedAt: Date, value: number): Promise<boolean> {
  const series = await prisma.indicatorSeries.findUnique({ where: { key: seriesKey } });
  if (!series) {
    console.warn(`[ingest] unknown series ${seriesKey}, skipping point`);
    return false;
  }
  const existing = await prisma.indicatorPoint.findFirst({
    where: { seriesId: series.id, observedAt },
  });
  if (existing) return false;
  await prisma.indicatorPoint.create({ data: { seriesId: series.id, observedAt, value } });
  return true;
}
