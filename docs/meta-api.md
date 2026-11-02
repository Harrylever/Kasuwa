# Meta API reference — SOURCE OF TRUTH

All runtime AI goes through Meta's Model API or Meta open-weight models on a
partner. Never call Claude/GPT/Gemini. Keep every model ID in env vars.

Sources: [quickstart](https://dev.meta.ai/docs/quickstart),
[models](https://dev.meta.ai/docs/models),
[pricing](https://dev.meta.ai/docs/pricing-rate-limits),
[speech-to-text](https://dev.meta.ai/docs/speech-to-text),
[structured output](https://dev.meta.ai/docs/structured-output),
[SDKs](https://dev.meta.ai/docs/sdks). Hackathon pin from the saved
Cerebral Valley event page in this repo.

## 1. Base URL + auth

- Base URL: `https://api.meta.ai/v1`
- Auth: `Authorization: Bearer $MODEL_API_KEY`. Get the key from the
  [Model API dashboard](https://dev.meta.ai/docs/authentication) → API keys →
  export as `MODEL_API_KEY`. The API is OpenAI-compatible: the OpenAI SDK
  works with `baseURL: "https://api.meta.ai/v1"` — but it does NOT auto-read
  `MODEL_API_KEY`, so pass `api_key` explicitly (or set `OPENAI_API_KEY`).
- Our `.env` mapping: `META_API_KEY` (= `MODEL_API_KEY`),
  `META_API_BASE_URL=https://api.meta.ai/v1`.

## 2. Protocols (all OpenAI-shaped)

| Use | Endpoint | Notes |
|---|---|---|
| Forecasting, extraction, triage (default) | `POST /v1/responses` | Recommended. Native multimodal input; keeps encrypted reasoning across turns via `include: ["reasoning.encrypted_content"]`. Answer text in the `message` item (`response.output_text` in SDK). |
| Drop-in OpenAI compat | Chat Completions | Same base URL, standard shape. |
| Claude-Code-style harnesses | Messages API | Point at `https://api.meta.ai`. |

Minimal curl:

```bash
curl -X POST "https://api.meta.ai/v1/responses" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "muse-spark-1.3", "input": "Hello"}'
```

Error to expect: `404 model_not_found` means a bad model ID — use one below.

## 3. Model IDs (env vars, never hardcoded)

| Purpose | Env var | Model ID | Notes |
|---|---|---|---|
| Forecasting (flagship reasoning) | `MODEL_FORECAST` | `muse-spark-1.3` | Default in all quickstart examples. Muse Spark 1.1/1.2 also listed. |
| Extraction / triage / headlines (cheap) | `MODEL_EXTRACT` | `meta-models/muse-spark-open-1026` | ⚠️ Hackathon pin: the event page says "The docs use `meta-models/muse-spark-open`. For the hackathon, use `meta-models/muse-spark-open-1026` instead." Seen in the Baseten section — confirm provider routing (Baseten vs Fireworks vs Modal) in Discord if calls fail. |
| Radio transcription | `MODEL_TRANSCRIBE` | `muse-voice-transcribe-1.0` | See §4. 25 languages with code-switching. |

Open-weight partners for the hackathon: Baseten ($100 credits + 2M TPM for up
to 2,000 participants), Modal ($100), Fireworks ($100 + workshop). Each has its
own base URL + key → `OPEN_WEIGHT_PROVIDER`, `OPEN_WEIGHT_API_KEY`,
`OPEN_WEIGHT_BASE_URL`. The open-weight route also qualifies us for the
Best Build on Open-Weight Models bonus (partner verifies the project runs on
an eligible Meta open-weight model).

## 4. Speech-to-text (radio ingest)

`POST https://api.meta.ai/v1/asr/transcribe` with `multipart/form-data`,
two parts: JSON `request` + audio file.

```bash
curl -X POST 'https://api.meta.ai/v1/asr/transcribe?sessionId=my-session-id' \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -F 'request={"mode":"DIARIZATION","model":"muse-voice-transcribe-1.0","audioEncoding":"WAV"};type=application/json' \
  -F 'audio=@clip.wav;type=audio/wav'
```

- `mode`: `DIARIZATION` (multi-speaker w/ labels — best for radio) or
  `ENDPOINTING`. Fixed for the session once set.
- Returns turn-level timestamps (not word-level). Streaming via
  `Accept: text/event-stream` yields per-chunk `DELTA` text.
- Watch the size caps per request (see docs page); split long clips.

## 5. Structured output

The API supports structured output (see docs page). Our `packages/llm`
validates every JSON call against a Zod schema, retries once with the
validation error appended, then fails loudly — that stays as-is.

## 6. Cost ledger inputs (TODO: fill exact rates)

- Pricing is per 1M tokens, with **Standard** vs **Contributor** modes
  (Muse Spark 1.1 is Standard-only). Exact $/1M input/output rates did not
  come through cleanly — copy them from the
  [pricing page](https://dev.meta.ai/docs/pricing-rate-limits) here before
  trusting `costUsd` math. $150 in credits, our guard stops at
  `LLM_BUDGET_USD=120`.
- Token counting endpoint exists (`count-input-tokens`) for pre-flight
  estimates on big evidence bundles.

## 7. Still open (Dean / Discord)

- [x] Knowledge cutoff: lands INSIDE the Jun–Sep 2026 window (confirmed
  2026-11-01). Decision: keep the window, state the contamination caveat
  openly on the backtest page and in the README per PLAN §7. The leakage
  guard (publishedAt ≤ as-of) still holds — the caveat is about pretrained
  knowledge, not pipeline leakage.
- [ ] Which partner endpoint serves `meta-models/muse-spark-open-1026`
  (Baseten implied — confirm) + claim the $100 partner credits.
- [ ] Rate limits for our tier (RPM/TPM) → set `packages/llm` concurrency
  accordingly.
