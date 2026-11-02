# Kasuwa

**Kasuwa** (Hausa for "market") is a forecasting engine for price shocks in Nigerian food markets. It reads news, radio and official price data, turns them into falsifiable, time-bound probabilities, and tells small food businesses what to do about them, with the impact in naira.

> "Rice (50kg) likely to rise 10–15% within 3 weeks (71%). **Buy 2 weeks ahead**: est. saving ₦38,000 on your usage."

Built for the **Meta Global AI Developer Hackathon** (Oct 27 – Nov 4, 2026), track: *Build for Your World*.

## The problem

Restaurants, grocers, food-delivery businesses and small processors in Nigeria ask one question every week: **buy now, or wait?** Prices move fast with FX, fuel and supply shocks, and most small buyers decide by gut feel. They stock up too late, or lock cash into inventory they didn't need yet.

## How it works

```
news + radio + NBS prices
        │
   ingest (idempotent, publishedAt kept for every item)
        │
   triage ── keyword guard + Muse Spark Open ──► drops political / conflict / irrelevant
        │
   cluster (TF-IDF, no LLM): 40 reports of one story = 1 event
        │
   questions (template-based, resolvable against real price series)
        │
   3 forecasting agents (base-rate · trend · contrarian) ──► validated against as-of evidence
        │
   log-odds aggregate, weighted by agent trust
        │
   resolve → Brier score → trust weights update
        │
   vertical pack `decide()` ──► BUY_AHEAD / BUY_AS_USUAL / DELAY_PURCHASE / ADJUST_MENU_PRICE
```

Design choices worth knowing:

- **The LLM never picks the action.** `decide()` and `simulate()` in each vertical pack are pure, unit-tested TypeScript. The model only writes the plain-language headline.
- **Forecasts must cite evidence.** Every cited item must exist and have `publishedAt <= asOf`; fewer than two valid citations forces the agent to abstain. (In a live run, the base-rate agent abstained for exactly this reason.)
- **Scoring closes the loop.** Resolved forecasts get Brier scores; agent weights update multiplicatively and every change is logged.
- **Vertical packs.** Everything specific to one audience (series, questions, actions, exposure form) lives in `packages/verticals`. `food_buyer` is complete; `logistics` (fuel buyers) is a stub that proves the engine generalizes.

## Where Meta models are used

| Model | Role |
|---|---|
| **Muse Spark** (`MODEL_FORECAST`) | The three forecasting agents |
| **Muse Spark Open** `meta-models/muse-spark-open-1026` (`MODEL_EXTRACT`) | High-volume triage, classification and recommendation text. Intended to run on an open-weight partner (Baseten) |
| **Muse Voice Transcribe** (`MODEL_TRANSCRIBE`) | Transcribes Nigerian radio clips into evidence |

All runtime AI is Meta models. `mustUseMetaModel()` refuses to start if a non-Meta provider key is present in the environment.

## Political and conflict content

The hackathon excludes political and war content, so Kasuwa filters it out twice, and **both checks must pass**: a whole-word keyword guard in code, then the model's own `excluded` classification. In the current dataset, 37 of 47 flagged items were dropped; the excluded count is logged on every run.

## Status

Honest snapshot as of Nov 2:

| Piece | State |
|---|---|
| Scoring, aggregation, trust updates (`packages/core`) | Done, tested |
| Vertical packs (`packages/verticals`) | `food_buyer` done, `logistics` stub |
| Meta client with cache, cost ledger, budget guard (`packages/llm`) | Done |
| Ingest, triage, cluster, questions, forecast, recommendations | Running end to end on real data |
| Dashboard (`apps/web`) | Built, moving from demo data to the database |
| Backtest and ₦ savings simulation | In progress, needs multi-month NBS price history |
| Radio transcription | In progress |

## Built during the hackathon

Everything in this repository was written during the build window (Oct 27 – Nov 4, 2026). No code is copied from other projects.

## Run it locally

Requires [Bun](https://bun.sh), PostgreSQL and Redis.

```bash
bun install
cp .env.example .env      # fill in META_API_KEY and model IDs
bun run db:push           # create the schema
bun run pipeline          # ingest → triage → cluster → questions → forecast
bun run dev               # dashboard at http://localhost:3000
bun run test              # unit tests
```

Individual steps: `bun run ingest | triage | retriage | cluster | questions | forecast`.

Model IDs and spend limits live in environment variables only; see `.env.example` and `docs/meta-api.md`.

## Repository layout

```
apps/web          Next.js dashboard
apps/worker       ingest, triage, cluster, questions, forecast
packages/core     scoring and aggregation (pure, tested)
packages/verticals  food_buyer and logistics packs
packages/llm      the only place that talks to models
packages/db       Prisma schema and seed data
```

## Limitations

- Forecasts are probabilistic estimates, not financial advice.
- Nigerian official price data (NBS) is published monthly, so backtests run at monthly resolution; we don't interpolate to fake finer precision.
- A backtest is only meaningful if its window falls after the model's knowledge cutoff; we state the window and the caveat alongside any result.
