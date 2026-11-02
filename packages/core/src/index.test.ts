import { describe, expect, test } from "bun:test"
import {
  aggregateLogOdds,
  brier,
  calibrationBins,
  clampProbability,
  logLoss,
  updateAgentTrust,
} from "./index"

describe("core scoring", () => {
  test("brier rewards correct confident forecasts", () => {
    expect(brier(0.9, true)).toBeLessThan(brier(0.6, true))
    expect(brier(0.1, true)).toBeGreaterThan(0.5)
  })

  test("logLoss penalizes confident wrong answers", () => {
    expect(logLoss(0.99, false)).toBeGreaterThan(logLoss(0.6, false))
  })

  test("clamp keeps probabilities inside [0.02, 0.98]", () => {
    expect(clampProbability(0)).toBe(0.02)
    expect(clampProbability(1)).toBe(0.98)
  })

  test("log-odds aggregation favors confident agent", () => {
    const { probability } = aggregateLogOdds([0.9, 0.5], [1, 1])
    expect(probability).toBeGreaterThan(0.6)
  })

  test("trust update rewards low brier", () => {
    const next = updateAgentTrust({ a: 0.5, b: 0.5 }, { a: 0.05, b: 0.4 })
    expect(next.a).toBeGreaterThan(next.b)
  })

  test("calibration bins count coverage", () => {
    const bins = calibrationBins([0.1, 0.9, 0.8], [false, true, true], 2)
    expect(bins.reduce((s, x) => s + x.count, 0)).toBe(3)
  })
})
