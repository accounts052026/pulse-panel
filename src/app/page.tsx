"use client"
import { useState, useEffect, useCallback } from "react"
import Sidebar from "@/components/Sidebar"
import TransactionTabs from "@/components/TransactionTabs"
import InsightBoard from "@/components/InsightBoard"
import PlatformLedger from "@/components/PlatformLedger"
import MonthlyView from "@/components/MonthlyView"
import type { Transaction } from "@/lib/supabase"
import type { View } from "@/components/types"

export default function Home() {
  const [view, setView]                 = useState<View>("insight")
  const [platform, setPlatform]         = useState("All")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [saving, setSaving]             = useState(false)
  const [loading, setLoading]           = useState(false)
  const [dateFrom, setDateFrom]         = useState("")
  const [dateTo,   setDateTo]           = useState("")
  const [err, setErr]                   = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo)   params.set("to",   dateTo)
      if (platform && platform !== "All") params.set("platform", platform)
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setTransactions(await res.json())
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo, platform])

  useEffect(() => { load() }, [load])

  const handleSave = async (txs: Transaction[]) => {
    setSaving(true); setErr("")
    try {
      // Batch into chunks of 200 to stay under Vercel's 4.5MB body limit
      const CHUNK = 200
      for (let i = 0; i < txs.length; i += CHUNK) {
        const chunk = txs.slice(i, i + CHUNK)
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      await load()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  // Stats
  const totalAR  = transactions.filter(t => t.type === "sales_invoice").reduce((s, t) => s + t.amount, 0)
  const received = transactions.filter(t => t.type === "payment_received").reduce((s, t) => s + t.amount, 0)
  const returns  = transactions.filter(t => t.type === "credit_note").reduce((s, t) => s + t.amount, 0)
  const outstanding = totalAR - returns - received

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n)

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase()

  const VIEW_TITLES: Record<View, string> = {
    insight: "INSIGHTBOARD",
    monthly: "MONTH-WISE",
    enter:   "ENTER DATA",
    ledger:  "PLATFORM LEDGER",
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar view={view} setView={setView} platform={platform} setPlatform={setPlatform} />

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar — dark */}
        <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase">{today}</div>
            <div className="text-lg font-bold tracking-wide mt-0.5">
              {VIEW_TITLES[view]}{" "}
              {platform !== "All" && (
                <span className="text-violet-400 font-bold">{platform.toUpperCase()}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Invoice</div>
              <div className="text-xl font-bold text-white">₹{fmt(totalAR)}</div>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Received</div>
              <div className="text-xl font-bold text-emerald-400">₹{fmt(received)}</div>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Outstanding</div>
              <div className={`text-xl font-bold ${outstanding < 0 ? "text-rose-400" : "text-amber-400"}`}>
                ₹{fmt(outstanding)}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            {/* Date filter */}
            <div className="flex items-center gap-2 text-xs">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs" />
              <span className="text-slate-500">–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs" />
              <button onClick={load}
                className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded text-xs font-medium">
                {loading ? "…" : "Filter"}
              </button>
            </div>
          </div>
        </header>

        {/* Error bar */}
        {err && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2 text-sm text-rose-600">{err}</div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {view === "enter"   && <TransactionTabs onSave={handleSave} saving={saving} />}
          {view === "insight" && <InsightBoard    transactions={transactions} />}
          {view === "ledger"  && <PlatformLedger  transactions={transactions} />}
          {view === "monthly" && <MonthlyView     transactions={transactions} />}
        </main>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>{transactions.length} transactions loaded</span>
          <button onClick={load} className="hover:text-violet-600 font-medium">↻ Refresh</button>
        </div>
      </div>
    </div>
  )
}
