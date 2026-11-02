import { addIndicatorPoint, prisma, upsertRawItem, upsertSource } from "./db";

function parseGdeltDate(seen: string): Date {
  // Usually YYYYMMDDHHMMSS; be lenient with short/odd values.
  const digits = (seen ?? "").replace(/\D/g, "").padEnd(14, "0").slice(0, 14);
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6)) - 1;
  const d = Number(digits.slice(6, 8));
  const h = Number(digits.slice(8, 10));
  const min = Number(digits.slice(10, 12));
  const s = Number(digits.slice(12, 14));
  const dt = new Date(Date.UTC(y, m, d, h, min, s));
  if (Number.isNaN(dt.getTime()) || y < 2000) return new Date();
  return dt;
}

export async function ingestGdelt(): Promise<number> {
  const sourceId = await upsertSource("GDELT DOC", "gdelt", "https://api.gdeltproject.org/api/v2/doc/doc");
  const queries = [
    'Nigeria (economy OR inflation OR "food prices" OR "fuel price" OR naira)',
    'Nigeria (rice OR beans OR garri OR tomatoes OR "vegetable oil") prices',
  ];
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  let added = 0;
  for (const q of queries) {
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
      encodeURIComponent(q) +
      "&mode=artlist&maxrecords=25&format=json&timespan=1week&sort=date";
    let res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.status === 429) {
      console.warn("[gdelt] 429, waiting 45s and retrying once");
      await sleep(45_000);
      res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    }
    if (!res.ok) {
      console.warn(`[gdelt] ${res.status} for query, skipping`);
      continue;
    }
    await sleep(6_000);
    const json = (await res.json()) as { articles?: Array<{ url: string; title: string; seendate: string; sourcecountry?: string }> };
    for (const a of json.articles ?? []) {
      const ok = await upsertRawItem({
        sourceId,
        externalId: a.url,
        title: a.title,
        body: a.title,
        url: a.url,
        publishedAt: parseGdeltDate(a.seendate),
      });
      if (ok) added++;
    }
  }
  console.log(`[gdelt] +${added} items`);
  return added;
}

// --- RSS: minimal item parser, no new deps ---
const FEEDS = [
  { name: "BusinessDay", url: "https://businessday.ng/feed/" },
  { name: "Nairametrics", url: "https://nairametrics.com/feed/" },
  { name: "Punch Business", url: "https://punchng.com/feed/" },
];

function parseRss(xml: string): Array<{ title: string; link: string; pubDate: string; desc: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; desc: string }> = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (tag: string): string => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      if (!mm) return "";
      return mm[1].replace("<![CDATA[", "").replace("]]>", "").trim();
    };
    items.push({ title: pick("title"), link: pick("link"), pubDate: pick("pubDate"), desc: pick("description") });
  }
  return items;
}

export async function ingestRss(): Promise<number> {
  let added = 0;
  for (const f of FEEDS) {
    const sourceId = await upsertSource(f.name, "rss", f.url);
    let xml: string;
    try {
      const res = await fetch(f.url, {
        signal: AbortSignal.timeout(60_000),
        headers: { "User-Agent": "KasuwaBot/0.1 (hackathon research)" },
      });
      if (!res.ok) {
        console.warn(`[rss] ${f.name} ${res.status}, skipping`);
        continue;
      }
      xml = await res.text();
    } catch (e) {
      console.warn(`[rss] ${f.name} fetch failed: ${(e as Error).message}`);
      continue;
    }
    for (const it of parseRss(xml)) {
      if (!it.link || !it.title) continue;
      const pub = it.pubDate ? new Date(it.pubDate) : new Date();
      const ok = await upsertRawItem({
        sourceId,
        externalId: it.link,
        title: it.title.slice(0, 500),
        body: `${it.title}\n\n${it.desc.replace(/<[^>]*>/g, "").slice(0, 2000)}`,
        url: it.link,
        publishedAt: Number.isNaN(pub.getTime()) ? new Date() : pub,
      });
      if (ok) added++;
    }
  }
  console.log(`[rss] +${added} items`);
  return added;
}

// --- FX: free rates API, no key ---
export async function ingestFx(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.warn(`[fx] ${res.status}, skipping`);
    return 0;
  }
  const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
  const ngn = json.rates?.NGN;
  if (!ngn) {
    console.warn("[fx] no NGN rate, skipping");
    return 0;
  }
  const at = json.time_last_update_utc ? new Date(json.time_last_update_utc) : new Date();
  const ok = await addIndicatorPoint("fx.ngn_usd.official", at, ngn);
  console.log(`[fx] USD/NGN=${ngn} ${ok ? "(new)" : "(dup)"}`);
  return ok ? 1 : 0;
}

// --- Open-Meteo: free, no key. Rain summary per food state as evidence. ---
const STATES = [
  { name: "Benue", lat: 7.73, lon: 8.53 },
  { name: "Kaduna", lat: 10.52, lon: 7.44 },
  { name: "Kano", lat: 12.0, lon: 8.52 },
  { name: "Plateau", lat: 9.93, lon: 8.89 },
];

export async function ingestWeather(): Promise<number> {
  const sourceId = await upsertSource("Open-Meteo", "indicator", "https://api.open-meteo.com");
  let added = 0;
  for (const s of STATES) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}` +
      `&daily=precipitation_sum&past_days=92&forecast_days=1&timezone=Africa%2FLagos`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      console.warn(`[weather] ${s.name} ${res.status}, skipping`);
      continue;
    }
    const json = (await res.json()) as { daily?: { time?: string[]; precipitation_sum?: number[] } };
    const sums = json.daily?.precipitation_sum ?? [];
    const days = sums.length || 92;
    const rainy = sums.filter((v) => (v ?? 0) > 2).length;
    const total = sums.reduce((a, v) => a + (v ?? 0), 0);
    const ok = await upsertRawItem({
      sourceId,
      externalId: `weather-${s.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
      title: `${s.name} rainfall: ${rainy} rainy days in last ${days} (${total.toFixed(0)}mm total)`,
      body: `Open-Meteo daily precipitation for ${s.name} food-producing belt. ${rainy}/${days} days above 2mm, ${total.toFixed(0)}mm total. Relevant to tomato/onion supply.`,
      publishedAt: new Date(),
    });
    if (ok) added++;
  }
  console.log(`[weather] +${added} items`);
  return added;
}

// --- NBS: no public API. Manual CSV drop: data/nbs/<seriesKey>.csv ---
export async function ingestNbs(): Promise<number> {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../../../../data/nbs", import.meta.url);
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".csv"));
  } catch {
    console.log("[nbs] data/nbs/ empty — drop <seriesKey>.csv files (seriesKey,observedAt,value header). Skipping.");
    return 0;
  }
  let added = 0;
  for (const f of files) {
    const text = await readFile(new URL(f, `${dir}/`), "utf8");
    const lines = text.trim().split("\n").slice(1);
    for (const line of lines) {
      const [seriesKey, observedAt, value] = line.split(",");
      if (!seriesKey || !observedAt || !value) continue;
      if (await addIndicatorPoint(seriesKey.trim(), new Date(observedAt.trim()), Number(value))) added++;
    }
  }
  console.log(`[nbs] +${added} points from ${files.length} files`);
  return added;
}

export async function ingestAll(): Promise<void> {
  const results = await Promise.allSettled([
    ingestGdelt(),
    ingestRss(),
    ingestFx(),
    ingestWeather(),
    ingestNbs(),
  ]);
  const names = ["gdelt", "rss", "fx", "weather", "nbs"];
  results.forEach((r, i) => {
    if (r.status === "rejected") console.warn(`[${names[i]}] FAILED: ${(r.reason as Error).message}`);
  });
  const counts = await prisma.rawItem.count();
  const points = await prisma.indicatorPoint.count();
  console.log(`[ingest] totals: ${counts} rawItems, ${points} indicatorPoints`);
}
