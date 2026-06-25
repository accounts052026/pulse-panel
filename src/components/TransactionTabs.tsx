"use client"
import { useState } from "react"
import Grid, { ColDef } from "./Grid"
import { PLATFORMS, detectPlatform } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

const TAB_CONFIG: { key: TxType; label: string; icon: string; desc: string; arSide: boolean }[] = [
  { key: "sales_invoice",    label: "Sales Invoices",    icon: "🧾", desc: "Our invoices raised to platforms",     arSide: true  },
  { key: "credit_note",      label: "Credit Notes",      icon: "📝", desc: "Returns & Brand Funded Discounts",    arSide: true  },
  { key: "payment_received", label: "Payments Received", icon: "💰", desc: "Payments received from platforms",    arSide: true  },
  { key: "bill_received",    label: "Bills Received",    icon: "📄", desc: "Platform charges against us (AP)",    arSide: false },
  { key: "vendor_credit",    label: "Vendor Credits",    icon: "🔄", desc: "Credit notes received from platform", arSide: false },
  { key: "payment_made",     label: "Payments Made",     icon: "💸", desc: "Payments made to platforms",          arSide: false },
]

const BASE_COLS: ColDef[] = [
  { key: "date",        label: "Date",        width: 110, type: "date"   },
  { key: "document_no", label: "Doc No.",     width: 120, type: "text"   },
  { key: "entity",      label: "Entity",      width: 150, type: "text"   },
  { key: "platform",    label: "Platform",    width: 110, type: "select", options: [...PLATFORMS] },
  { key: "description", label: "Description", width: 200, type: "text"   },
  { key: "debit",       label: "Debit (Dr)",  width: 110, type: "number" },
  { key: "credit",      label: "Credit (Cr)", width: 110, type: "number" },
  { key: "amount",      label: "Amount",      width: 110, type: "number" },
  { key: "tds",         label: "TDS",         width: 90,  type: "number" },
  { key: "status",      label: "Status",      width: 100, type: "text"   },
]

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

export default function TransactionTabs({ onSave, saving }: Props) {
  const [activeTab, setActiveTab] = useState<TxType>("sales_invoice")
  const [data, setData] = useState<Record<TxType, Record<string, string>[]>>(
    () => Object.fromEntries(TAB_CONFIG.map((t) => [t.key, []])) as any
  )
  const [msg, setMsg] = useState("")

  const tab = TAB_CONFIG.find((t) => t.key === activeTab)!

  const handleSave = async () => {
    const allRows: Transaction[] = []
    for (const [type, rows] of Object.entries(data) as [TxType, Record<string, string>[]][]) {
      for (const row of rows) {
        if (!row.date && !row.amount && !row.document_no) continue
        const entity   = row.entity || ""
        const platform = row.platform || detectPlatform(entity)
        allRows.push({
          type,
          date:        row.date || new Date().toISOString().slice(0, 10),
          document_no: row.document_no,
          platform,
          entity,
          description: row.description,
          debit:  parseFloat(row.debit  || "0") || 0,
          credit: parseFloat(row.credit || "0") || 0,
          amount: parseFloat(row.amount || "0") || 0,
          tds:    parseFloat(row.tds    || "0") || 0,
          status: row.status || "Open",
        })
      }
    }
    if (!allRows.length) { setMsg("No data to save."); return }
    await onSave(allRows)
    setMsg(`✓ ${allRows.length} rows saved`)
    setTimeout(() => setMsg(""), 3000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex overflow-x-auto border-b border-slate-200">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? t.arSide ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-rose-500 text-rose-700 bg-rose-50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon} {t.label}
            {data[t.key].length > 0 && (
              <span className="ml-1 bg-slate-200 text-slate-600 text-xs rounded-full px-1.5">{data[t.key].length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-slate-500">{tab.icon} {tab.desc}. Paste directly from Zoho (Ctrl+A → Ctrl+C → click first cell → Ctrl+V).</p>
          <div className="flex items-center gap-2">
            {msg && <span className="text-sm text-emerald-600 font-medium">{msg}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "⚡ Save All to DB"}
            </button>
          </div>
        </div>
        <Grid
          cols={BASE_COLS}
          rows={data[activeTab]}
          onChange={(r) => setData((prev) => ({ ...prev, [activeTab]: r }))}
          headerClass={tab.arSide ? "grid-ar-header" : "grid-ap-header"}
        />
      </div>
    </div>
  )
}
