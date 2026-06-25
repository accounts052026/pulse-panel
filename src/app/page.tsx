"use client"
import { useState, useEffect, useCallback } from "react"
import TransactionTabs from "@/components/TransactionTabs"
import InsightBoard from "@/components/InsightBoard"
import PlatformLedger from "@/components/PlatformLedger"
import MonthlyView from "@/components/MonthlyView"
import type { Transaction } from "@/lib/supabase"

type View = "enter" | "insight" | "ledger" | "monthly"

const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "enter",   label: "Enter Data",      icon: "📥" },
  { key: "insight", label: "InsightBoard",    icon: "📊" },
  { key: "ledger",  label: "Platform Ledger", icon: "📚" },
  { key: "monthly", label: "Month-wise",      icon: "📅" },
]

export default function Home() {
  const [view, setView]                 = useState<View>("enter")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [saving, setSaving]             = useState(false)
  const [loading, setLoading]           = useState(false)
  const [dateFrom, setDateFrom]         = useState("")
  const [dateTo,   setDateTo]           = useState("")
  const [err, setErr]                   = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo)   params.set("to",   dateTo)
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setTransactions(await res.json())
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const handleSave = async (txs: Transaction[]) => {
    setSaving(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txs),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const arTotal = transactions
    .filter((t) => t.type === "sales_invoice")
    .reduce((s, t) => s + t.amount, 0)

  const netCash = arTotal
    - transactions.filter((t) => ["credit_note","payment_received"].includes(t.type)).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-indigo-700">⚡ Pulse Panel</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Live AR/AP Tracker</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <span className="text-slate-500">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={load} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium">
              {loading ? "…" : "Filter"}
            </button>
          </div>
          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-mono font-semibold">
            AR Outstanding ≈ ₹{new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(netCash)}
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1 items-center">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                view === v.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 py-2">
            {err && <span className="text-xs text-rose-600">{err}</span>}
            <span className="text-xs text-slate-400">{transactions.length} transactions</span>
            <button onClick={load} className="text-xs text-indigo-500 hover:text-indigo-700">↻ Refresh</button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {view === "enter"   && <TransactionTabs onSave={handleSave} saving={saving} />}
        {view === "insight" && <InsightBoard    transactions={transactions} />}
        {view === "ledger"  && <PlatformLedger  transactions={transactions} />}
        {view === "monthly" && <MonthlyView     transactions={transactions} />}
      </main>
    </div>
  )
}
