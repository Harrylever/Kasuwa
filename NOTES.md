# NOTES.md — running decisions, open issues, Dean TODOs

## Decisions
- 2026-11-01: Moved `kasuwa-web/` → `apps/web` (package renamed to `web`)
  per PLAN §3. Root workspaces are now `apps/*` + `packages/*`. Reinstalled,
  tests (10 pass) + typecheck green after the move.
- 2026-11-01: `.agents` skills applied: `frontend-design` (market-grounded,
  one memorable element), `vercel-react-best-practices` (server-first, no
  waterfalls, dynamic charts), `use-railway` (worker deploy path).
- UI direction: Seadeal shell (dark premium, pill buttons, section rhythm) +
  PriceIt market layer (cream ink orange, ₦ cards, market names, location pill).

## Dean TODO (by hand)
- [x] `docs/meta-api.md` filled from public docs (2026-11-01). Still open:
  cutoff dates, partner routing for `muse-spark-open-1026`, exact $/1M rates.
- [ ] Confirm the `muse-spark-open-1026` provider routing in Discord if calls fail
- [ ] Confirm NBS Price Watch items actually published (rice 50kg, beans, garri, oil, flour, sugar, tomatoes, onions)
- [ ] Provide `data/radio/*.mp3` clips with known timestamps
- [x] Local dev DB live (2026-11-01): postgres db `kasuwa`, schema pushed,
  seeded (2 demo businesses, 8 series, rice Jun–Sep points). Redis PONG at
  6379. `.env` created (gitignored). Note: sandbox blocks my TCP/socket
  connects, so my DB commands run escalated; your own terminal commands work
  normally with `DATABASE_URL="postgresql://localhost:5432/kasuwa?schema=public"`.
- [ ] Provision Neon/Supabase Postgres + Upstash Redis for prod deploy
- [ ] `bunx prisma db push` once DATABASE_URL is set

## Build notes (2026-11-01)
- `bun test packages/core packages/verticals`: 10 pass, 0 fail.
- `tsc --noEmit` in kasuwa-web: clean.
- `bun run build`: green (needed one escalated-sandbox run; Turbopack CSS
  workers are blocked under the default sandbox — environmental, not code).
- Removed `next/font/google` from layout (offline-safe system stack); build
  used to fail fetching Geist at compile time.
- Root `node_modules` is a symlink to `kasuwa-web/node_modules` until a real
  `bun install` can run (sandbox blocks it); gives workspace packages `zod`.
- No git repo yet — init + first commit still pending (needs your go-ahead per
  source-control safety).

## Ingest status (2026-11-01)
- Live in db: 70 RawItems (Punch 34, Nairametrics 25, BusinessDay 7,
  Open-Meteo 4), 5 IndicatorPoints (rice Jun–Sep seed + USD/NGN 1348.45).
- GDELT DOC: persistent 429s even with 45s retry (we burst it on the first
  run). Retry logic stays in; RSS covers evidence meanwhile. Re-check on the
  next scheduled run before replacing the source.
- NBS: no public API — `data/nbs/<seriesKey>.csv` drop + importer ready.
- `bun apps/worker/src/run-ingest.ts` from repo root (needs DATABASE_URL).

## Pipeline status (2026-11-01)
- Triage: 70/70 items, 23 usable (macro 8, weather 5, fuel 4, logistics 4,
  food 1, fx 1), 47 excluded (keyword guard + model). 6 batched LLM calls.
- MODEL_EXTRACT (`muse-spark-open-1026`) 404s on the main API — partner-routed.
  Triage + headlines run on MODEL_FORECAST until Baseten creds land (claim $100).
- Cluster: 23 items → 20 events (TF-IDF, no LLM). Questions: 1 open
  (rice PCT_CHANGE; garri/beans/PMS skipped — no price data yet, needs NBS).
- First live forecast: base_rate abstained (<2 valid evidence — validator
  works), trend 0.18, contrarian 0.15, aggregate 0.16. Recommendations stored
  for both demo businesses (Mama Put: DELAY_PURCHASE on rice).
- `bun apps/worker/src/{run-ingest,triage,cluster,questions,forecast}.ts`

## Open issues
- Backtest window must be after model cutoff; unknown until meta-api lands.
- Parallel-market FX source unverified; official rate only for v1 if blocked.
