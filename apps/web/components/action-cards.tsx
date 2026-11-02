import { actions, naira } from "@/lib/demo";

const badge: Record<string, string> = {
  BUY_AHEAD: "bg-[#E04421] text-white",
  BUY_AS_USUAL: "bg-[#EDE7DA] text-[#1C1410]",
  DELAY_PURCHASE: "bg-[#1C1410] text-white",
  ADJUST_MENU_PRICE: "bg-[#F2A33C] text-[#1C1410]",
};

export function ActionCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {actions.map((a) => (
        <article
          key={a.id}
          className="rounded-3xl bg-white p-5 text-left shadow-[0_18px_50px_-20px_rgba(28,20,16,0.35)]"
        >
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${badge[a.action]}`}>
            {a.action.replaceAll("_", " ")}
          </span>
          <p className="mt-3 text-sm font-semibold text-[#8A7565]">
            {a.item} · {a.market}
          </p>
          <h3 className="mt-1 text-lg font-extrabold leading-snug text-[#1C1410]">{a.headline}</h3>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#1C1410]">
            {a.expectedImpactNgn > 0 ? `Save ${naira(a.expectedImpactNgn)}` : "No extra spend"}
          </p>
          <p className="mt-1 text-xs text-[#8A7565]">
            {Math.round(a.probability * 100)}% · {a.confidence} confidence
          </p>
          <details className="mt-3 text-sm text-[#5A4A3F]">
            <summary className="cursor-pointer font-bold text-[#C2560A]">Why this?</summary>
            <p className="mt-2">{a.detail}</p>
            <p className="mt-2 text-xs">How we calculated this: {a.formula}</p>
            <ul className="mt-2 space-y-1 text-xs">
              {a.evidence.map((e) => (
                <li key={e.label}>
                  <span className="font-bold">[{e.source}]</span> {e.label}
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
    </div>
  );
}
