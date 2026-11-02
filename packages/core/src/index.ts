export function brier(probability: number, outcome: boolean): number {
  const o = outcome ? 1 : 0
  return (probability - o) ** 2
}

export function logLoss(probability: number, outcome: boolean): number {
  const p = Math.min(0.999, Math.max(0.001, probability))
  return outcome ? -Math.log(p) : -Math.log(1 - p)
}

function toLogOdds(p: number): number {
  const c = Math.min(0.98, Math.max(0.02, p))
  return Math.log(c / (1 - c))
}

function fromLogOdds(lo: number): number {
  return 1 / (1 + Math.exp(-lo))
}

export function aggregateLogOdds(
  probs: number[],
  weights: number[],
): { probability: number; weightsSnapshot: number[] } {
  const active = probs
    .map((p, i) => ({ p, w: weights[i] ?? 1 }))
    .filter((x) => Number.isFinite(x.p))
  if (active.length === 0) return { probability: 0.5, weightsSnapshot: weights }
  const total = active.reduce((s, x) => s + x.w, 0) || 1
  const lo = active.reduce((s, x) => s + (x.w / total) * toLogOdds(x.p), 0)
  return { probability: fromLogOdds(lo), weightsSnapshot: weights }
}

export function updateAgentTrust(
  weights: Record<string, number>,
  briers: Record<string, number>,
  eta = 2,
): Record<string, number> {
  const next: Record<string, number> = {}
  let total = 0
  for (const k of Object.keys(weights)) {
    const b = briers[k] ?? 0.25
    next[k] = weights[k] * Math.exp(-eta * b)
    total += next[k]
  }
  for (const k of Object.keys(next))
    next[k] = total > 0 ? next[k] / total : 1 / Object.keys(next).length
  return next
}

export function clampProbability(p: number): number {
  return Math.min(0.98, Math.max(0.02, p))
}

export function calibrationBins(
  probs: number[],
  outcomes: boolean[],
  bins = 5,
): { bin: string; predicted: number; observed: number; count: number }[] {
  const out: {
    bin: string
    predicted: number
    observed: number
    count: number
  }[] = []
  for (let i = 0; i < bins; i++) {
    const lo = i / bins
    const hi = (i + 1) / bins
    const idx = probs
      .map((p, j) => ({ p, j }))
      .filter(({ p }) => p >= lo && (p < hi || (i === bins - 1 && p <= hi)))
    const count = idx.length
    const predicted = count
      ? idx.reduce((s, x) => s + x.p, 0) / count
      : (lo + hi) / 2
    const observed = count
      ? idx.reduce((s, x) => s + (outcomes[x.j] ? 1 : 0), 0) / count
      : 0
    out.push({
      bin: `${Math.round(lo * 100)}-${Math.round(hi * 100)}%`,
      predicted,
      observed,
      count,
    })
  }
  return out
}
