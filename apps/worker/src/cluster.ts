import { prisma } from "@kasuwa/db";

const STOP = new Set(
  "the,a,an,and,or,of,to,in,on,for,with,at,by,from,as,is,are,was,were,be,been,it,its,this,that,these,those,nigeria,nigerian,said,says,new,over,after,before,amid,among,between,up,down,more,most,over,under,about,into,through,during".split(","),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9₦ ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function tfidf(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [t, c] of tf) vec.set(t, (c / d.length) * Math.log(n / (df.get(t) ?? 1)));
    return vec;
  });
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, v] of a) {
    na += v * v;
    const w = b.get(t);
    if (w !== undefined) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function clusterEvents(): Promise<number> {
  const items = await prisma.rawItem.findMany({
    where: { excluded: false, category: { not: null } },
    orderBy: { publishedAt: "asc" },
  });
  const docs = items.map((it) => tokens(`${it.title} ${it.body.slice(0, 800)}`));
  const vecs = tfidf(docs);
  const assigned = new Array(items.length).fill(-1);
  const clusters: number[][] = [];

  for (let i = 0; i < items.length; i++) {
    let best = -1;
    let bestSim = 0.22;
    for (let c = 0; c < clusters.length; c++) {
      const j = clusters[c][0];
      if (items[i].category !== items[j].category) continue;
      const days = Math.abs(items[i].publishedAt.getTime() - items[j].publishedAt.getTime()) / 86_400_000;
      if (days > 7) continue;
      const sim = cosine(vecs[i], vecs[j]);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best === -1) {
      clusters.push([i]);
      assigned[i] = clusters.length - 1;
    } else {
      clusters[best].push(i);
      assigned[i] = best;
    }
  }

  let created = 0;
  for (const cluster of clusters) {
    const members = cluster.map((i) => items[i]);
    const first = members[0];
    const title = first.title.slice(0, 200);
    const ev = await prisma.event.create({
      data: {
        title,
        summary: `${members.length} item(s), ${first.category}`,
        category: first.category ?? "macro",
        region: "Nigeria",
        severity: Math.max(...members.map((m) => m.severity ?? 3)),
        firstSeenAt: members[0].publishedAt,
        lastSeenAt: members[members.length - 1].publishedAt,
      },
    });
    for (const m of members) {
      await prisma.eventItem.create({ data: { eventId: ev.id, rawItemId: m.id } }).catch(() => {});
    }
    created++;
  }
  console.log(`[cluster] ${items.length} items -> ${created} events`);
  return created;
}

if (import.meta.main) {
  await clusterEvents().finally(() => prisma.$disconnect());
  process.exit(0);
}
