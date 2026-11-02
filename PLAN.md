# Kasuwa — Build Plan (Meta Global AI Developer Hackathon, Startup Track)

> Working name: **Kasuwa** (Hausa for "market"). Rename freely.
> Build window: **Oct 27 – Nov 4, 2026**. Submission due **Nov 4, 9:00 PM ET (3:00 AM Nov 5, Lagos)**.
> Read this whole file before writing any code. Work phase by phase. Commit at the end of every task.

---

## 1. What we're building

Kasuwa is a forecasting engine for **price and supply shocks in Nigerian and West African markets**. It reads news, radio broadcasts, and real-time economic data. It turns them into **falsifiable, time-bound probability forecasts**, such as:

> "Will the average national retail price of PMS (petrol) in the next NBS Price Watch exceed ₦1,100/litre? — **64%** (resolves Dec 15)"

Every forecast has cited evidence, a resolution date, and an automatic resolution. When a forecast resolves, the system scores itself with Brier scores and calibration, then updates **trust weights** for its sources and forecasting agents. Over time it measurably improves.

### Hero persona (what the demo is built around)

**SME food buyers**: restaurants, food delivery and grocery businesses, small supermarkets, and small food processors. Their daily question is **"buy now, or wait?"** They stock up too late, or lock cash into inventory that then gets cheaper. One price shock in rice or oil can wipe out a month's margin.

Kasuwa doesn't show them raw probabilities. It turns forecasts into **actions with naira impact**:

> "Rice (50kg) likely to rise 10–15% within 3 weeks (71%). **Buy 2 weeks ahead** — est. saving ₦38,000 on your usage. [evidence]"

### Built to expand: vertical packs

The engine underneath (ingest, triage, forecasting, scoring, trust) is **shared**. Everything specific to one audience lives in a **vertical pack**: which price series matter, which questions to ask, what a business tells us about its exposure, and how forecasts become actions.

- **v1 (hackathon): `food_buyer`**, fully built and in the demo.
- **v1.5 (stub, proves extensibility): `logistics`**, for delivery and logistics companies exposed to petrol and diesel prices. Actions: pre-buy fuel or lock a supplier price, adjust delivery fees.
- **Later:** lenders and fintechs (portfolio exposure to input-cost shocks), importers (FX timing), agritech.

The business model follows the same split: free public price-shock alerts build the audience and track record; paid dashboards and an API serve businesses through their vertical pack.

### Hard constraints (from hackathon rules)

1. **All runtime AI must use Meta models**, through the Meta Model API or Meta open-weight models on a partner (Fireworks, Baseten, Modal). The app must never call Claude, GPT, Gemini, or any other non-Meta model.
2. **No political or war content.** The hackathon's anti-project list bans "anything political or involving war." The pipeline must **filter out** political, election, conflict, and security events, and generate **economic questions only**. This is enforced in code (see §6.2), not just in prompts.
3. **New work only.** Everything is written fresh in this repo during the build window. Don't copy code from other projects.
4. **Public repo.** No secrets committed, ever. Use `.env`, keep `.env.example` up to date, and add `.env` to `.gitignore` in the first commit.

---

## 2. Before writing code — Meta API reference

`docs/meta-api.md` contains the Meta Model API quickstart, plus the hackathon note on which model IDs to use (the hackathon requires a specific dated version of the open model). **Treat that file as the source of truth.**

- **Never guess** endpoints, request shapes, or model IDs. Read them from `docs/meta-api.md`.
- If something you need isn't in that file, stop and ask Dean.
- Keep all model IDs in config (env vars), never hardcoded:

```
META_API_KEY=
META_API_BASE_URL=
MODEL_FORECAST=        # flagship reasoning model (e.g. Muse Spark) — forecasting agents
MODEL_EXTRACT=         # cheaper/open-weight model — extraction, triage, classification
MODEL_TRANSCRIBE=      # Meta voice transcription model — radio ingest
OPEN_WEIGHT_PROVIDER=  # fireworks | baseten | modal (for the open-weight model)
OPEN_WEIGHT_API_KEY=
OPEN_WEIGHT_BASE_URL=
LLM_BUDGET_USD=120     # hard stop; we have $150 in credits
DATABASE_URL=
REDIS_URL=
```

**Why two model tiers:** the flagship model handles forecasting, where reasoning quality matters. An open-weight Meta model on a partner handles high-volume extraction. This keeps costs down, shows "beyond basic integration" use of Meta tooling (a judging criterion), and qualifies us for the Best Build on Open-Weight Models bonus.

---

## 3. Stack

- **Monorepo:** Bun + Turborepo
- `apps/web` — Next.js (App Router), Tailwind, Recharts for charts
- `apps/worker` — Bun/Node worker running scheduled jobs with BullMQ
- `packages/db` — Prisma + PostgreSQL
- `packages/llm` — the **only** place that talks to models: Meta client wrapper, caching, cost tracking, budget guard
- `packages/core` — pure logic: scoring, aggregation, trust updates (unit-tested). **Knows nothing about any specific vertical.**
- `packages/verticals` — one folder per vertical pack (`food-buyer/`, `logistics/`), each implementing the `VerticalPack` interface (§6.0)
- **Hosting (Phase 5):** Vercel for web, Railway or Fly for the worker, and Neon or Supabase for Postgres, plus Upstash Redis

---

## 4. LLM layer rules (`packages/llm`)

Build this first. Everything else depends on it.

1. **One client** wrapping the Meta Model API (and the open-weight provider), shaped to match `docs/meta-api.md`.
2. **Structured output:** every call that expects JSON validates against a Zod schema. On a parse failure, retry once with the validation error appended, then fail loudly.
3. **Response cache:** hash the model, prompt, and params, and store the response in Postgres. Reruns during development cost nothing. On by default, with a per-call option to bypass.
4. **Cost ledger:** log every call (model, tokens in/out, estimated cost, purpose) to an `LlmCall` table.
5. **Budget guard:** if total spend reaches `LLM_BUDGET_USD`, refuse new calls and throw a clear error.
6. **Concurrency limit** and exponential backoff on rate limits.

---

## 5. Data model (Prisma, starting point)

```
Source          id, name, kind (rss|gdelt|radio|indicator), url, trustWeight, createdAt
RawItem         id, sourceId, externalId, title, body, url, publishedAt, fetchedAt, lang
                -- publishedAt is critical: the backtest must never see items after its as-of date
Transcript      id, sourceId, audioUrl, text, startedAt, durationSec
Event           id, title, summary, category, region, severity, firstSeenAt, lastSeenAt
EventItem       eventId, rawItemId          -- clustering join table
IndicatorSeries id, key (e.g. "fx.ngn_usd.official", "pms.national.avg", "food.rice_50kg.national"),
                unit, frequency, sourceId
IndicatorPoint  seriesId, observedAt, value
Question        id, vertical, templateId, text, type (threshold), seriesKey, operator (gt|lt), threshold,
                resolveAt, createdAt, createdAsOf, status (open|resolved|void),
                outcome (bool?), resolvedValue
Forecast        id, questionId, agent (base_rate|trend|contrarian), probability,
                rationale, evidenceIds (json), asOf, createdAt, abstained (bool)
AggregateForecast id, questionId, probability, asOf, weightsSnapshot (json)
Score           id, questionId, forecastId?, aggregate (bool), brier, logLoss
TrustWeightLog  id, subjectType (source|agent), subjectId, oldWeight, newWeight, reason, at
BacktestRun     id, asOfStart, asOfEnd, horizonDays, status, summary (json), createdAt
LlmCall         id, model, purpose, tokensIn, tokensOut, costUsd, cached, createdAt

-- Vertical / business layer
Business        id, name, vertical (food_buyer|logistics), region, createdAt
Exposure        id, businessId, data (json, validated by the vertical's exposureSchema)
                -- food_buyer: [{ seriesKey, weeklyQty, unit, storableWeeks, perishable }]
                -- logistics:  [{ fuel: "pms"|"ago", litresPerWeek }]
Recommendation  id, businessId, questionIds (json), action (enum per vertical), headline,
                detail, expectedImpactNgn, confidence, evidenceIds (json), asOf, createdAt
```

No auth for the hackathon. Seed 2–3 **clearly fictional** demo businesses (e.g. a Lagos restaurant, an Abuja grocery delivery service) and add a simple "create your business" form.

---

## 6. Pipeline

### 6.0 Vertical pack interface (`packages/verticals`)

Define this interface on Day 0, before the pipeline, so the shared engine never hardcodes food logic:

```ts
interface VerticalPack {
  id: "food_buyer" | "logistics";
  name: string;
  categories: Category[];               // triage categories that matter (e.g. food, fuel, weather, logistics)
  series: SeriesDef[];                  // indicator series it needs, and where they come from
  questionTemplates: QuestionTemplate[];// which forecast questions to generate
  exposureSchema: z.ZodSchema;          // what a business tells us about itself
  actions: readonly string[];           // allowed recommendation actions
  decide(input: {
    business: Business; exposure: unknown;
    forecasts: AggregateForecast[]; latest: IndicatorPoint[]; asOf: Date;
  }): RecommendationDraft[];            // pure function: forecasts + exposure → actions
  simulate(input: BacktestSimInput): BacktestSimResult; // strategy vs naive baseline (§7)
}
```

Rules:
- `decide` and `simulate` are **pure TypeScript** (no LLM calls) and unit-tested. The LLM only writes the plain-language `headline`/`detail` from the decided action. It never chooses the action.
- Adding a vertical must mean **adding a folder and registering it**, with no changes to `packages/core`, the worker pipeline, or the forecasting prompts. Treat any needed change there as a design smell and fix the abstraction.

**`food_buyer` pack (full):**
- Series: NBS food price items. Start with storable staples (rice 50kg, beans, garri, vegetable oil, flour, sugar) plus one or two perishables (tomatoes, onions). Verify which items NBS actually publishes and adjust.
- Actions: `BUY_AHEAD` (n weeks, bounded by `storableWeeks`), `BUY_AS_USUAL`, `DELAY_PURCHASE`, `ADJUST_MENU_PRICE` (perishables, where buying ahead isn't possible).
- Decision rule (starting point, tune it): if P(rise ≥ x%) ≥ 0.6 and the item is storable → `BUY_AHEAD`. If P(fall) ≥ 0.6 → `DELAY_PURCHASE`. Perishable with high P(rise) → `ADJUST_MENU_PRICE`. Otherwise → `BUY_AS_USUAL`.
- `expectedImpactNgn` = quantity affected × expected price change − simple holding cost. Keep the formula visible in the UI ("how we calculated this").

**`logistics` pack (stub):**
- Series: PMS (petrol) and AGO (diesel) prices.
- Actions: `PREBUY_FUEL`, `LOCK_SUPPLIER_PRICE`, `ADJUST_DELIVERY_FEE`, `HOLD`.
- Build the config, `exposureSchema`, `decide`, and tests. UI is a stretch goal (§9). Mention it in the README and demo as proof the engine generalizes.

### 6.1 Ingest (`apps/worker`)

Start with these sources. **Verify access to each one on Day 1.** If a source is blocked or paywalled, replace it and note the change in the README.

| Signal | Source | Use |
|---|---|---|
| Economic news | GDELT DOC API (Nigeria + economic themes), RSS from Nigerian business outlets (e.g. BusinessDay, Nairametrics, Punch business section) | Evidence |
| FX | A free FX rates API for NGN/USD official rate; parallel-market rate if a reliable public source exists | Indicator + resolution |
| Fuel and food prices | NBS (National Bureau of Statistics) monthly Price Watch reports (PMS, selected food items) | Indicator + **ground truth for resolution** |
| Weather / floods | Open-Meteo (has historical data, good for backtests) for key food-producing states | Evidence |
| Radio (differentiator) | Public Nigerian radio or podcast news clips, transcribed with `MODEL_TRANSCRIBE` | Evidence nobody else has |

Store everything raw with an accurate `publishedAt`. Make the ingesters **idempotent** (upsert on `externalId`).

**Radio:** for the hackathon, a folder of recorded public broadcast clips (`data/radio/*.mp3`) with known timestamps is enough. No live stream needed. Transcribe them, then treat each transcript as a `RawItem`.

### 6.2 Triage and topic filter (open-weight model)

For each `RawItem`, `MODEL_EXTRACT` returns JSON:

```
{ category: "fx" | "fuel" | "food" | "logistics" | "weather" | "macro" | "excluded",
  excludedReason?: "political" | "conflict" | "irrelevant",
  region, entities[], summary, severity (1-5) }
```

- Items classified `excluded` are **dropped from all downstream steps**, and the count is logged.
- Add a second **keyword guard** in code (elections, parties, campaign, insurgency, bandits, military, etc.) that also excludes items. **Both checks must pass.** Don't rely on the model alone.

### 6.3 Cluster into events

Group items covering the same development into one `Event` so 40 reports count as one signal. Use **non-LLM** methods (TF-IDF or MinHash similarity, category, region, and a time window) so no non-Meta AI is involved. Optionally, have `MODEL_EXTRACT` write a one-line summary of each event.

### 6.4 Question generation

Questions come from the **registered vertical packs' `questionTemplates`**, de-duplicated across packs (food and logistics may both want a PMS question; generate it once and share the forecast).

**Template-based** questions, so every one can be resolved automatically against an `IndicatorSeries`:

- `FX_THRESHOLD`: "Will {series} be {above/below} {threshold} on {date}?"
- `PRICE_RELEASE`: "Will the next NBS {item} national average exceed {threshold}?"
- `PCT_CHANGE`: "Will {item} rise more than {x}% month-over-month in the next release?"

Pick thresholds near the current value plus or minus a plausible move, so forecasts are informative, not near 0% or 100%. The model may **rank** which questions matter given recent events, but it never invents question types. No question may reference politics or conflict.

### 6.5 Forecasting ensemble (`MODEL_FORECAST`)

Three agent personas forecast each open question independently. Each one gets the question, the indicator history, and the relevant events and items **up to `asOf` only**:

- **Base-rate analyst:** how often has a move this size happened historically?
- **Trend extrapolator:** where is momentum pointing?
- **Contrarian / risk analyst:** what would make the obvious answer wrong?

Output (Zod-validated):

```
{ probability: 0..1, rationale: string, evidenceIds: string[], abstain: boolean }
```

**Validator rules (in code):**
- Every `evidenceId` must exist **and** have `publishedAt <= asOf`. Otherwise reject and retry once.
- Fewer than 2 valid evidence items means a forced `abstain: true`.
- Clamp probabilities to [0.02, 0.98].

### 6.6 Aggregate (`packages/core`)

Weighted average of agent probabilities **in log-odds space**, using current agent trust weights. Abstaining agents are excluded. Store the weights snapshot with every `AggregateForecast`.

### 6.7 Resolve, score, and update trust

A daily job resolves due questions from `IndicatorPoint` data, then:

- Computes Brier score and log loss for each agent forecast and for the aggregate.
- **Agent trust update:** multiplicative weights, `w ← w · exp(-η · brier)`, then normalize. Log every change to `TrustWeightLog`.
- **Source trust update:** sources whose items were cited in better-scoring forecasts gain weight; consistently poor ones lose it. Keep the rule simple, documented in the README, and tested.

All of `packages/core` (Brier, log loss, log-odds aggregation, weight updates, calibration bins) gets **unit tests**.

### 6.8 Recommendations

After each aggregation run, for every `Business`: load its vertical pack, call `decide` with its exposure and the latest forecasts, then have `MODEL_EXTRACT` write a short plain-language headline and explanation for each decided action. Every recommendation links back to its forecasts and cited evidence, so a buyer can tap through to "why".

---

## 7. Backtest harness (the centrepiece of the demo)

`BacktestRun` replays history: for each as-of date `d` in a window (weekly steps), generate questions, forecast **using only data with `publishedAt <= d`**, resolve against real outcomes, and score.

Requirements:
- **No leakage.** Every DB query in the forecasting path takes `asOf` and filters by it. Write a test that fails if any query skips the filter.
- **Model knowledge cutoff:** the model may already "know" outcomes from its training data. Choose a backtest window **after** the model's stated knowledge cutoff (check `docs/meta-api.md` or ask Dean). If that's impossible, say so plainly in the README.
- **Baselines:** compare against (a) always predict 50%, and (b) persistence (yesterday's direction continues). The demo headline is **Kasuwa vs baseline Brier**.
- Output: overall Brier, Brier per agent, calibration curve data, trust-weight trajectory, and a list of notable hits and misses with their evidence.

### 7.1 Buyer savings simulation (the demo headline)

Run each demo business through the backtest window with the vertical pack's `simulate`:

- **Naive buyer:** buys exactly its usage each period at the actual price.
- **Kasuwa buyer:** follows the recommendations `decide` produced *at that time* (as-of data only), paying actual prices, with holding cost and storage limits applied.
- Report **₦ saved and % saved** per item and in total, plus the worst calls (where following Kasuwa cost money). Show losses honestly; it makes the result credible.

Simulate at the frequency of the real price data (NBS is monthly; use a finer source if one is found). Don't interpolate prices to fake weekly precision.

The video line is: *"A restaurant following Kasuwa from {month} to {month} would have saved ₦X (Y%) on staples."*

---

## 8. Dashboard (`apps/web`)

**Business view (what the buyer sees, lead with this in the demo):**
1. **My basket**: onboarding form to pick items, weekly quantities, storage weeks. Uses the vertical's `exposureSchema` to render the form, so a logistics pack can reuse it.
2. **This week's actions**: recommendation cards (BUY AHEAD / BUY AS USUAL / DELAY / ADJUST PRICE), each with the naira impact, a confidence level in plain words, and a "why" link.
3. **Why this?**: the forecast behind a recommendation, the three agents' reasoning, and the cited evidence (including radio transcript snippets).

**Engine view (proves the depth, for judges):**
4. **Forecast board**: all open questions, aggregate probability, change since yesterday, days to resolution, category chips.
5. **Backtest report**: buyer savings simulation (§7.1) first, then Kasuwa vs baselines, calibration chart, per-agent scores, hits and misses.
6. **Trust view**: source and agent weights over time, showing the system learning.
7. **Signal feed**: latest triaged events, plus a count of items excluded by the topic filter (shows the guardrail working).

Clean, dark, data-dense design. Mobile-friendly enough to screenshot for X.

---

## 9. Schedule

| Day | Date | Goal | Done when |
|---|---|---|---|
| 0 | Oct 26 | Repo setup, `docs/meta-api.md` in place, env, Prisma schema, `VerticalPack` interface | `bun dev` runs; first Meta API call succeeds through `packages/llm` |
| 1 | Oct 27 | LLM layer (cache, cost ledger, budget guard) + news and indicator ingest for the food series | Items and indicator points in DB with correct `publishedAt` |
| 2 | Oct 28 | Triage + topic filter + clustering + radio transcription | Events visible in DB; excluded items logged |
| 3 | Oct 29 | Question templates (from `food_buyer` pack) + forecasting ensemble + validator | Open questions with 3 agent forecasts each, evidence-checked |
| 4 | Oct 30 | Aggregation, resolution, scoring, trust updates + `food_buyer.decide` + unit tests | `packages/core` and pack tests green; recommendations generated for seeded businesses |
| 5 | Oct 31 | Backtest harness + baselines + buyer savings simulation | A backtest run reports Brier vs baselines **and** ₦ saved |
| 6 | Nov 1 | Business view (basket, actions, why-this) + backtest report page | Buyer flow works end to end on real data |
| 7 | Nov 2 | Forecast board, trust view, signal feed, deploy; `logistics` pack stub (config + decide + tests) | Public URL works; logistics pack tests green |
| 8 | Nov 3 | **Freeze features.** Bug fixes, README, record demo video | 3-min video recorded |
| 9 | Nov 4 | X thread, final README, submit **before evening Lagos time** | Submitted |

If behind schedule, cut in this order: logistics stub → source trust (keep agent trust) → radio → trust view page → signal feed. **Never cut the backtest, the savings simulation, or the business view**, because together they are the demo.

Stretch (only if everything above is done): logistics business view using the same generic pages, and a WhatsApp-style weekly alert preview for a business.

---

## 10. README requirements (judges read this)

- One-paragraph pitch and the problem.
- Architecture diagram and a **"How we use Meta models"** section: which model does what, and why.
- Who it's for: SME food buyers first, and how the vertical-pack design extends to logistics and lenders (point to `packages/verticals`).
- How the topic guardrail works.
- Backtest method, leakage protections, and the model-cutoff caveat.
- Results: Brier vs baselines, with a calibration chart screenshot.
- Setup instructions and `.env.example`.
- Note that all code was written during the hackathon window.

---

## 11. Working rules for Claude Code

- Before starting each phase, restate its goal and the files you'll touch, then build.
- Small commits with clear messages. Commit history should tell the build story.
- Never commit secrets. Never hardcode model IDs or API URLs.
- Never add a dependency on a non-Meta AI model or API.
- Write tests for anything in `packages/core` and for the `asOf` leakage guard.
- When a data source fails or needs a decision (paywall, missing data, unclear API), stop and ask Dean instead of improvising.
- Keep a running `NOTES.md` with decisions, open issues, and anything Dean needs to do by hand.
