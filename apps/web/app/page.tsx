import { ActionCards } from "@/components/action-cards"
import { BacktestReport } from "@/components/backtest-report"
import { BasketForm } from "@/components/basket-form"
import { ForecastBoard } from "@/components/forecast-board"
import { trust } from "@/lib/demo"

export default function Home() {
  return (
    <div className="min-h-full bg-[#FAF5EC] font-sans text-[#1C1410]">
      <header className="sticky top-0 z-10 border-b border-[#EADFCD] bg-[#FAF5EC]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <span className="text-xl font-extrabold tracking-tight">Kasuwa</span>
          <span className="rounded-full border border-[#F6D9B8] bg-[#FFF3E6] px-3 py-1 text-xs font-bold text-[#C2560A]">
            Live in Lagos · Abuja
          </span>
          <nav className="ml-auto hidden gap-6 text-sm font-semibold text-[#5A4A3F] md:flex">
            <a href="#actions">Actions</a>
            <a href="#forecasts">Forecasts</a>
            <a href="#backtest">Backtest</a>
            <a href="#trust">Trust</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-[#0C111D] text-white">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
              Price-shock forecasts for Nigerian markets
            </span>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Buy now, or wait? Kasuwa answers with naira on it.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/70">
              News, radio, FX, and NBS prices become time-bound forecasts with
              cited evidence — then plain actions for your basket.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#actions"
                className="rounded-full bg-white px-6 py-3 font-bold text-[#0C111D]"
              >
                See this week&apos;s actions
              </a>
              <a
                href="#backtest"
                className="rounded-full border border-white/25 px-6 py-3 font-bold text-white"
              >
                How we score ourselves
              </a>
            </div>
          </div>
        </section>

        <section
          id="actions"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 py-12"
        >
          <h2 className="text-2xl font-extrabold">My basket</h2>
          <p className="mt-1 text-[#5A4A3F]">
            Pick your business. Actions retune to what you stock.
          </p>
          <div className="mt-4">
            <BasketForm />
          </div>
          <h2 className="mt-10 text-2xl font-extrabold">
            This week&apos;s actions
          </h2>
          <div className="mt-4">
            <ActionCards />
          </div>
        </section>

        <section id="forecasts" className="bg-[#0C111D] py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-extrabold text-white">
              Forecast board
            </h2>
            <p className="mt-1 text-white/60">
              Every question resolves against real price data. Evidence is
              cited, never vibes.
            </p>
            <div className="mt-4">
              <ForecastBoard />
            </div>
          </div>
        </section>

        <section
          id="backtest"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 py-12"
        >
          <BacktestReport />
        </section>

        <section id="trust" className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#EADFCD] bg-white p-6">
              <h3 className="font-extrabold">Trust weights learn over time</h3>
              {trust.agents.map((a) => (
                <div
                  key={a.name}
                  className="mt-3 flex items-center gap-3 text-sm"
                >
                  <span className="w-24 font-bold">{a.name}</span>
                  <div className="h-2 flex-1 rounded-full bg-[#F2E9DA]">
                    <div
                      className="h-full rounded-full bg-[#E04421]"
                      style={{ width: `${a.weight * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-bold">
                    {Math.round(a.weight * 100)}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-[#EADFCD] bg-white p-6">
              <h3 className="font-extrabold">Signal feed + guardrail</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#5A4A3F]">
                <li>[NBS] Rice +4.1% MoM — food · severity 4</li>
                <li>
                  [Radio] Mile 12 traders cite transport costs — fuel · severity
                  3
                </li>
                <li>[FX] Official NGN/USD +1.8% — fx · severity 2</li>
              </ul>
              <p className="mt-4 rounded-full bg-[#FFF3E6] px-4 py-2 text-sm font-bold text-[#C2560A]">
                {trust.excluded} political/conflict items excluded by the topic
                filter.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#EADFCD] px-6 py-8 text-sm text-[#8A7565]">
        <p className="mx-auto max-w-6xl">
          Kasuwa demo · fictional businesses · all runtime AI uses Meta models
          only · political and conflict content is filtered in code.
        </p>
      </footer>
    </div>
  )
}
