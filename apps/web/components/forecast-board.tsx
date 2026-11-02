import { forecasts } from "@/lib/demo";

export function ForecastBoard() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {forecasts.map((f) => (
        <article key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/70">
              {f.tag}
            </span>
            <span className="text-xs text-white/50">{f.days}d to resolve</span>
          </div>
          <p className="mt-2 font-semibold text-white">{f.q}</p>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-3xl font-extrabold text-white">{Math.round(f.p * 100)}%</span>
            <span className={`text-sm font-bold ${f.change >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {f.change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(f.change * 100))}pts
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#F2A33C]" style={{ width: `${f.p * 100}%` }} />
          </div>
        </article>
      ))}
    </div>
  );
}
