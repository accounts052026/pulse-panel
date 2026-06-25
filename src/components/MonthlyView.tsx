"use client"
import { useState, useMemo } from "react"
import { PLATFORMS } from "@/lib/platforms"
import { fmt } from "@/lib/calculations"
import type { Transaction } from "@/lib/supabase"

interface Props { transactions: Transaction[] }

export default function MonthlyView({ transactions }: Props) {
  const [platform, setPlatform] = useState("All")

  const filtered = platform === "All" ? transactions : transactions.filter((t) => t.platform === platform)

  const byMonth = useMemo(() => {
    const map: Record<string, { invoice: number; payment: number; outstanding: number; returns: number }> = {}
    for (const t of filtered) {
      const month = t.date?.slice(0, 7) ?? "Unknown"
      if (!map[month]) map[month] = { invoice: 0, payment: 0, outstanding: 0, returns: 0 }
      if (t.type === "sales_invoice")    map[month].invoice += t.amount
      if (t.type === "payment_received") map[month].payment += t.amount
      if (t.type === "credit_note")      map[month].returns += t.amount
    }
    for (const m of Object.values(map)) m.outstanding = m.invoice - m.returns - m.payment
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const totals = byMonth.reduce(
    (acc, [, d]) => ({ invoice: acc.invoice + d.invoice, payment: acc.payment + d.payment, returns: acc.returns + d.returns, outstanding: acc.outstanding + d.outstanding }),
    { invoice: 0, payment: 0, returns: 0, outstanding: 0 }
  )

  const exportCsv = () => {
    const header = "Month,Invoice,Returns,Net Sales,Payment Received,Outstanding"
    const lines  = byMonth.map(([m, d]) => `${m},${d.invoice},${d.returns},${d.invoice - d.returns},${d.payment},${d.outstanding}`)
    const blob   = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `pulse-panel-monthly-${platform}.csv`; a.click()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold text-slate-800 text-lg">Month-wise Performance</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {["All", ...PLATFORMS.slice(0, -1)].map((p) => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${platform === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm hover:bg-slate-200">↓ CSV</button>
        </div>
      </div>
      <div className="p-4 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {["Month","Invoice","Returns / CN","Net Sales","Received","Outstanding"].map((h) => (
                <th key={h} className="px-4 py-2 text-right first:text-left font-medium text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byMonth.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No data yet — paste transactions in Enter Data tab</td></tr>
            )}
            {byMonth.map(([month, d], i) => (
              <tr key={month} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-4 py-2 font-medium">{month}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(d.invoice)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-600">{d.returns ? fmt(d.returns) : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(d.invoice - d.returns)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{fmt(d.payment)}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${d.outstanding < 0 ? "text-rose-600" : "text-slate-800"}`}>{fmt(d.outstanding)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.invoice)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-rose-600">{fmt(totals.returns)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.invoice - totals.returns)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{fmt(totals.payment)}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${totals.outstanding < 0 ? "text-rose-600" : ""}`}>{fmt(totals.outstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
