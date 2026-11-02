import { z } from "zod";
import { createHash } from "node:crypto";

export const Schemas = {
  TriageSchema: z.object({
    category: z.enum(["fx", "fuel", "food", "logistics", "weather", "macro", "excluded"]),
    excludedReason: z.enum(["political", "conflict", "irrelevant"]).optional(),
    region: z.string(),
    entities: z.array(z.string()),
    summary: z.string(),
    severity: z.number().min(1).max(5),
  }),
  ForecastSchema: z.object({
    probability: z.number().min(0).max(1),
    rationale: z.string(),
    evidenceIds: z.array(z.string()),
    abstain: z.boolean(),
  }),
};

const KEYWORDS = [
  "election", "elections", "party", "parties", "campaign", "vote", "voting",
  "insurgency", "insurgent", "bandit", "bandits", "military", "coup",
  "terrorist", "terrorism", "war", "conflict", "militant",
];

// Whole-word match so "war" doesn't hit "software"/"warehouse". Hyphens count as word breaks
// ("pre-election", "post-war" are caught); "third-party" is the one common business false positive.
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "i");
const SAFE_PHRASES = /third[- ]party/gi;

export function keywordGuard(text: string): { excluded: boolean; hit?: string } {
  const m = KEYWORD_RE.exec(text.replace(SAFE_PHRASES, " "));
  return m ? { excluded: true, hit: m[1].toLowerCase() } : { excluded: false };
}

export function mustUseMetaModel(): void {
  const forbidden = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"];
  for (const k of forbidden) {
    if (process.env[k]) throw new Error(`Non-Meta model key detected (${k}). Refusing per hackathon rules.`);
  }
}

function baseUrl(): string {
  return process.env.META_API_BASE_URL?.trim() || "https://api.meta.ai/v1";
}

function apiKey(): string {
  const k = process.env.META_API_KEY?.trim();
  if (!k) throw new Error("Missing META_API_KEY. See .env.example.");
  return k;
}

export function modelId(envName: "MODEL_FORECAST" | "MODEL_EXTRACT" | "MODEL_TRANSCRIBE"): string {
  const v = process.env[envName]?.trim();
  if (!v) throw new Error(`Missing ${envName}. See .env.example + docs/meta-api.md.`);
  return v;
}

export function cacheKey(model: string, system: string, user: string): string {
  return createHash("sha256").update([model, system, user].join("\n")).digest("hex");
}

// --- tiny in-process concurrency limit (max 4 concurrent Meta calls) ---
let inFlight = 0;
const queue: (() => void)[] = [];
async function acquire(): Promise<void> {
  if (inFlight < 4) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight++;
}
function release(): void {
  inFlight--;
  queue.shift()?.();
}

async function postResponses(opts: {
  model: string;
  system: string;
  user: string;
}): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  mustUseMetaModel();
  await acquire();
  try {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${baseUrl()}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          input: `${opts.system}\n\n${opts.user}`,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Meta API ${res.status}, retrying`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Meta API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as {
        output_text?: string;
        output?: Array<{ content?: Array<{ text?: string }> }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text =
        json.output_text ??
        json.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") ??
        "";
      return {
        text,
        tokensIn: json.usage?.input_tokens ?? 0,
        tokensOut: json.usage?.output_tokens ?? 0,
      };
    }
    throw lastErr instanceof Error ? lastErr : new Error("Meta API failed");
  } finally {
    release();
  }
}

export type LlmDb = {
  findCache: (hash: string) => Promise<{ response: string } | null>;
  saveCache: (hash: string, model: string, response: string) => Promise<void>;
  logCall: (row: {
    model: string;
    purpose: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    cached: boolean;
  }) => Promise<void>;
  totalSpend: () => Promise<number>;
};

export function usdCost(tokensIn: number, tokensOut: number): number {
  const perMIn = Number(process.env.LLM_USD_PER_M_IN ?? 0);
  const perMOut = Number(process.env.LLM_USD_PER_M_OUT ?? 0);
  if (!perMIn && !perMOut) {
    console.warn("[llm] No LLM_USD_PER_M_* rates set — USD guard is blind. Fill from docs/meta-api.md pricing.");
  }
  return (tokensIn * perMIn + tokensOut * perMOut) / 1_000_000;
}

export async function budgetGuard(db: LlmDb): Promise<void> {
  const cap = Number(process.env.LLM_BUDGET_USD ?? 120);
  const spent = await db.totalSpend();
  if (spent >= cap) throw new Error(`LLM budget exceeded: $${spent.toFixed(2)} >= $${cap}`);
}

export async function callMetaChat(
  db: LlmDb,
  opts: {
    system: string;
    user: string;
    purpose?: string;
    bypassCache?: boolean;
    modelEnv?: "MODEL_FORECAST" | "MODEL_EXTRACT" | "MODEL_TRANSCRIBE";
  },
): Promise<string> {
  const model = modelId(opts.modelEnv ?? "MODEL_FORECAST");
  const hash = cacheKey(model, opts.system, opts.user);
  if (!opts.bypassCache) {
    const hit = await db.findCache(hash);
    if (hit) {
      await db.logCall({ model, purpose: opts.purpose ?? "chat", tokensIn: 0, tokensOut: 0, costUsd: 0, cached: true });
      return hit.response;
    }
  }
  await budgetGuard(db);
  const { text, tokensIn, tokensOut } = await postResponses({ model, system: opts.system, user: opts.user });
  if (!text) throw new Error("Empty response from Meta API");
  await db.saveCache(hash, model, text);
  await db.logCall({
    model,
    purpose: opts.purpose ?? "chat",
    tokensIn,
    tokensOut,
    costUsd: usdCost(tokensIn, tokensOut),
    cached: false,
  });
  return text;
}

export async function structuredCall<T>(
  db: LlmDb,
  schema: z.ZodSchema<T>,
  input: {
    system: string;
    user: string;
    purpose?: string;
    modelEnv?: "MODEL_FORECAST" | "MODEL_EXTRACT" | "MODEL_TRANSCRIBE";
  },
): Promise<T> {
  const raw = await callMetaChat(db, input);
  const first = schema.safeParse(tryParseJson(raw));
  if (first.success) return first.data;
  const retry = await callMetaChat(db, {
    ...input,
    user: `${input.user}\n\nPrevious output failed validation, fix the JSON:\n${raw.slice(0, 1000)}`,
    bypassCache: true,
  });
  return schema.parse(tryParseJson(retry));
}

function tryParseJson(raw: string): unknown {
  const m = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m ? m[0] : raw);
  } catch {
    return raw;
  }
}
