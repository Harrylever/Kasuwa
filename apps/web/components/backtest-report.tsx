import { backtest, naira } from "@/lib/demo";

export function BacktestReport() {
  const max = Math.max(backtest.kasuwaBrier, backtest.baseline50, backtest.persistence);
  const bar = (v: number) => `${Math.max(6, (v / max) * 100)}%`;
  return (
    <div className="rounded-3xl bg-[#0C111D] p-6 text-white md:p-8">
      <p className="text-sm font-bold text-white/60">
        Backtest · {backtest.window} · pipeline filters publishedAt ≤ as-of
      </p>
      <p className="mt-2 max-w-3xl text-sm text-amber-200/90">
        Honest caveat: the models&apos; knowledge cutoff falls inside this window, so they
        may have seen some outcomes during training. Scores are still useful, but not a
        perfectly clean test.
      </p>
      <h3 className="mt-2 text-2xl font-extrabold md:text-3xl">
        A restaurant following Kasuwa would have saved {naira(backtest.savedNgn)} ({backtest.savedPct}%)
        on staples.
      </h3>
      <div className="mt-6 space-y-3">
        {[
          { name: "Kasuwa", v: backtest.kasuwaBrier },
          { name: "Persistence", v: backtest.persistence },
          { name: "Always 50%", v: backtest.baseline50 },
        ].map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <span className="w-28 text-sm font-bold text-white/70">{r.name}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${r.name === "Kasuwa" ? "bg-[#F2A33C]" : "bg-white/40"}`}
                style={{ width: bar(r.v) }}
              />
            </div>
            <span className="w-16 text-right text-sm font-bold">Brier {r.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-2 md:grid-cols-5">
        {backtest.calibration.map((c) => (
          <div key={c.bin} className="rounded-2xl bg-white/[0.05] p-3 text-center">
            <p className="text-xs font-bold text-white/60">{c.bin}</p>
            <p className="mt-1 text-lg font-extrabold">{c.observed}%</p>
            <p className="text-xs text-white/50">pred {c.predicted}% · n={c.count}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
        <p className="rounded-2xl bg-emerald-400/10 p-4">
          <span className="font-bold text-emerald-300">Hit — </span>
          {backtest.hits}
        </p>
        <p className="rounded-2xl bg-red-400/10 p-4">
          <span className="font-bold text-red-300">Miss — </span>
          {backtest.miss}
        </p>
      </div>
    </div>
  );
}
