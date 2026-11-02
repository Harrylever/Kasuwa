# TASKS.md — Kasuwa sprint to submission

**Deadline: Wed Nov 4, 9:00 PM ET = Thu Nov 5, 3:00 AM Lagos.** Aim to submit by **6:00 PM ET / midnight Lagos** to leave buffer.
Discord office hours: 10–11 AM ET (4–5 PM Lagos), weekdays. **Tue Nov 3 is the last full day for troubleshooting questions.**

## Where we are (Nov 2)

| Piece | State |
|---|---|
| `packages/core` (Brier, log-odds aggregate, trust, calibration) | Done, tested |
| `packages/verticals` (food_buyer full, logistics stub) | Done, tested |
| `packages/llm` (Meta `/responses` client, cache, ledger, budget, Zod) | Written, **never called against the live API** |
| `packages/db` (Prisma schema, seed) | Done, local DB seeded |
| `apps/worker` | Guards + validator only (43 lines). No ingest, forecasting, or backtest |
| `apps/web` | One page on **hardcoded** `lib/demo.ts` data |
| `data/radio/` | Empty |
| Open-weight provider (`OPEN_WEIGHT_*`) | Empty |
| Git / public repo | Not started |

The goal is **one real path end to end**: real inputs → Meta models → forecast → ₦ recommendation → backtest savings number. Breadth doesn't matter.

---

## Day 1 — Mon Nov 2: unblock + ingest

### Morning: unblockers (do these first, they gate everything)
- [ ] `git init`, check `.env` is ignored, first commit, push to a **public** GitHub repo
- [ ] Claim the $150 Meta credits (form + card on Billing page). **Deadline Nov 4.**
- [ ] Request Baseten **and** Modal credits now (approval takes time). Needed for the open-weight bonus.
- [ ] Smoke-test all three models with curl: `MODEL_FORECAST`, `MODEL_EXTRACT` (`muse-spark-open-1026`), `MODEL_TRANSCRIBE`
  - If the open-weight model fails through the Meta API, ask in Discord which partner routes it, then fill in `OPEN_WEIGHT_*`
- [ ] Ask in Discord: **what is Muse Spark's knowledge cutoff?** This sets the backtest window.

### Afternoon: real data (manual curation is fine)
- [ ] `data/prices.csv`: real NBS monthly values for **rice 50kg** + 1–2 more storable items (beans, garri, oil) + PMS. Source URL in each row.
- [ ] `data/news.json`: about 30–50 economic news items (Nairametrics / BusinessDay / Punch business RSS or GDELT), each with an accurate `publishedAt`, spanning the backtest window
- [ ] `data/radio/`: 4–6 short public radio/podcast clips about food or fuel prices, with known dates (record in a `clips.json`)

### Evening: ingest + triage
- [ ] `apps/worker/src/ingest.ts`: load prices → `IndicatorPoint`, news → `RawItem` (upsert on `externalId`)
- [ ] `transcribe.ts`: radio clips → Muse Voice Transcribe (`DIARIZATION`) → `Transcript` + `RawItem`
- [ ] `triage.ts`: `structuredCall(MODEL_EXTRACT, TriageSchema)` + `triageWithGuard`; log the excluded count
- [ ] Add a `bun run pipeline:ingest` script

**Done when:** the DB holds real prices, news, and transcripts, each triaged, and `LlmCall` shows real (non-cached) calls with costs.

---

## Day 2 — Tue Nov 3: forecasting, backtest, real UI

### Morning: forecasting engine
- [ ] `questions.ts`: generate threshold questions from `food_buyer.questionTemplates` for each as-of date (thresholds near current value ± a plausible move)
- [ ] `forecast.ts`: three personas (base-rate, trend, contrarian) → `structuredCall(MODEL_FORECAST, ForecastSchema)` → `validateForecast` (as-of evidence, ≥2 items) → `aggregateLogOdds` with trust weights → store
- [ ] `resolve.ts`: resolve against `IndicatorPoint`, then Brier/log loss, `updateAgentTrust`, `TrustWeightLog`
- [ ] Unit test proving no query in the forecast path skips the `asOf` filter

### Afternoon: backtest = the demo headline
- [ ] `backtest.ts`: step through as-of dates (monthly, at the NBS cadence), forecast only on data with `publishedAt <= asOf`, resolve, score
- [ ] Baselines: always 50%, and persistence. Output Kasuwa vs baseline Brier.
- [ ] Run `food_buyer.simulate` for "Mama Put Restaurant" → **₦ saved and %**, plus the worst calls (keep losses visible)
- [ ] `recommend.ts`: `decide()` → `MODEL_EXTRACT` writes only the headline/detail
- [ ] Watch `LlmCall` spend; keep the backtest small (one business, 3–4 items, 3–5 as-of dates)

### Evening: swap the UI to real data
- [ ] Replace `lib/demo.ts` with DB reads (server components)
- [ ] **This week's actions**: recommendation cards with ₦ impact + "how we calculated this"
- [ ] **Why this?**: three agent rationales + cited evidence, **including a radio transcript snippet** (this is the differentiator, so make it visible)
- [ ] **Backtest report**: savings first, then Brier vs baselines, calibration chart, trust trajectory

**Done when:** one real ₦ savings number from real data shows on screen, and clicking a card shows real agent reasoning with evidence.

---

## Day 3 — Wed Nov 4: ship (submit by 6 PM ET / midnight Lagos)

### Morning: deploy
- [ ] Neon Postgres: push the schema, then run the pipeline **locally** against Neon (skip deploying the worker; nobody judges cron)
- [ ] Deploy web to Vercel, using real data from Neon. Test it in a fresh browser.
- [ ] Bug-fix pass on the demo path only

### Afternoon: README + video
- [ ] README:
  - Problem and persona
  - Architecture diagram
  - Exactly which Meta model does what (Muse Spark ×3 agents, Muse Spark Open for triage/headlines, Muse Voice Transcribe for radio)
  - **"Built during the hackathon (Oct 27 – Nov 4)"** section
  - Political/conflict content filtering
  - Backtest method, cutoff caveat, and honest losses
  - How to run it
- [ ] Record the 3-minute video, showing only work built during the hackathon:
  - 0:00–0:20: hook. "A Lagos restaurant has to decide every week: buy rice now or wait?"
  - 0:20–1:20: business view. Actions → Why this? → agents + radio snippet.
  - 1:20–2:10: under the hood. Radio → transcribe → triage (political filter) → 3 agents → aggregate → trust.
  - 2:10–2:45: backtest. "Following Kasuwa from X to Y would have saved ₦N (P%)", plus Kasuwa vs baseline Brier, plus one honest miss.
  - 2:45–3:00: logistics pack proves the engine generalizes; close.

### Evening: submit
- [ ] Submit on the CV platform: repo public, video link opens logged-out, all teammates listed
- [ ] Post the demo on X and submit the link (Most Viral prize, engagement counts until Nov 8)
- [ ] Flag for the bonuses in the submission: Best Open Weight Build (if the partner route works), Best Agentic Use-Case

---

## Cut list (drop in this order if behind)
1. Logistics UI (keep the stub + tests, mention it in the video)
2. Event clustering (§6.3). Treat each item as its own evidence.
3. Source trust updates (keep agent trust)
4. Live RSS/GDELT fetching (use the curated `news.json`)
5. Calibration chart (keep the Brier vs baseline numbers)
6. **Never cut:** Meta model calls, radio transcription, the 3 agents, the ₦ savings number, the public repo, the video
