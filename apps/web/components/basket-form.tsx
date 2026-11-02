"use client"

import { useState } from "react"
import { businesses } from "@/lib/demo"

export function BasketForm() {
  const [business, setBusiness] = useState<string>(businesses[0].id)
  const [saved, setSaved] = useState(false)
  const current = businesses.find((b) => b.id === business)

  return (
    <form
      className="rounded-3xl border border-[#EADFCD] bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(true)
      }}
    >
      <label className="text-sm font-bold text-[#1C1410]" htmlFor="business">
        Your business
      </label>
      <select
        id="business"
        value={business}
        onChange={(e) => {
          setBusiness(e.target.value)
          setSaved(false)
        }}
        className="mt-2 w-full rounded-full border border-[#E4D7C2] bg-[#FAF5EC] px-4 py-3 font-semibold text-[#1C1410]"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} — {b.place}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm text-[#5A4A3F]">{current?.items}</p>
      <button
        type="submit"
        className="mt-4 rounded-full bg-[#E04421] px-6 py-3 font-bold text-white hover:bg-[#C2560A]"
      >
        {saved ? "Basket saved ✓" : "Save my basket"}
      </button>
      {saved && (
        <p className="mt-2 text-sm font-semibold text-emerald-700">
          Done. Actions below are tuned to {current?.name}.
        </p>
      )}
    </form>
  )
}
