"use client"
import { useState } from "react"
import { PLATFORMS, AR_TYPES, AP_TYPES } from "@/lib/platforms"
import { fmt } from "@/lib/calculations"
import type { Transaction } from "@/lib/supabase"

interface Props { transactions: Transaction[] }

export default function PlatformLedger({ transactions }: Props) {
  const [platform, setPlatform] = useState<Platform>(PLATFORMS[0])

  const ar = transactions.filter((t) => t.platform === platform && (AR_TYPES as readonly string[]).includes(t.type))
  const ap = transactions.filter((t) => t.platform === platform && (AP_TYPES as readonly string[]).includes(t.type))

  const LedgerTable = ({ rows, side }: { rows: Transaction[]; side: "AR" | "AP" }) => (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={side === "AR" ? "bg-emerald-100" : "bg-rose-100"}>
            {["Date","Doc No.","Type","Description","Dr","Cr","Amount","Status"].map((h) => (
              <th key={h} className={`px-3 py-2 text-left font-medium ${side === "AR" ? "text-emerald-800" : "text-rose-800"} whitespace-nowrap`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No data</td></tr>
          )}
          {rows.map((t, i) => (
            <tr key={t.id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="px-3 py-1.5 whitespace-nowrap">{t.date}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{t.document_no}</td>
              <td className="px-3 py-1.5">
                <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded">{t.type.replace(/_/g," ")}</span>
              </td>
              <td className="px-3 py-1.5 max-w-xs truncate">{t.description}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.debit ? fmt(t.debit) : ""}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.credit ? fmt(t.credit) : ""}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmt(t.amount)}</td>
              <td className="px-3 py-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.status === "Closed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {t.status || "Open"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-300">
            <td colSpan={6} className="px-3 py-2 font-semibold text-right">Total</td>
            <td className="px-3 py-2 font-bold text-right tabular-nums">
              {fmt(rows.reduce((s, t) => s + t.amount, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-4">
        <h2 className="font-semibold text-slate-800 text-lg">Platform Ledger</h2>
        <div className="flex gap-1">
          {PLATFORMS.slice(0, -1).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                platform === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">AR — Accounts Receivable ({ar.length} entries)</h3>
          <LedgerTable rows={ar} side="AR" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-rose-700 mb-2">AP — Accounts Payable ({ap.length} entries)</h3>
          <LedgerTable rows={ap} side="AP" />
        </div>
      </div>
    </div>
  )
}
