"use client"
import { useState } from "react"
import VirtualGrid, { VGColumn } from "./VirtualGrid"
import MasterInput from "./MasterInput"
import { detectPlatform } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

const TAB_CONFIG: { key: TxType; label: string; icon: string; desc: string; arSide: boolean }[] = [
  { key: "sales_invoice",    label: "Sales Invoices",    icon: "🧾", desc: "Our invoices raised to platforms",     arSide: true  },
  { key: "credit_note",      label: "Credit Notes",      icon: "📝", desc: "Returns & Brand Funded Discounts",    arSide: true  },
  { key: "payment_received", label: "Payments Received", icon: "💰", desc: "Payments received from platforms",    arSide: true  },
  { key: "bill_received",    label: "Bills Received",    icon: "📄", desc: "Platform charges against us (AP)",    arSide: false },
  { key: "vendor_credit",    label: "Vendor Credits",    icon: "🔄", desc: "Credit notes received from platform", arSide: false },
  { key: "payment_made",     label: "Payments Made",     icon: "💸", desc: "Payments made to platforms",          arSide: false },
]

// Default columns — paste auto-expands these
const BASE_COLS: VGColumn[] = [
  { key: "date",        label: "Date",         width: 110 },
  { key: "document_no", label: "Doc No.",      width: 130 },
  { key: "entity",      label: "Entity / Party", width: 180 },
  { key: "description", label: "Description",  width: 220 },
  { key: "debit",       label: "Debit (Dr)",   width: 110 },
  { key: "credit",      label: "Credit (Cr)",  width: 110 },
  { key: "amount",      label: "Amount",        width: 110 },
  { key: "tds",         label: "TDS",           width: 90  },
  { key: "status",      label: "Status",        width: 100 },
]

// Convert 2D string array → Transaction[]
function gridToTx(grid: string[][], cols: VGColumn[], type: TxType): Transaction[] {
  return grid
    .filter(row => row.some(v => v?.trim()))
    .map(row => {
      const get = (key: string) => row[cols.findIndex(c => c.key === key)] ?? ""
      const entity   = get("entity")
      const platform = detectPlatform(entity) || "Other"
      const debit    = parseNum(get("debit"))
      const credit   = parseNum(get("credit"))
      const amount   = parseNum(get("amount")) || Math.abs(debit - credit) || debit || credit
      return {
        type,
        date:        normalizeDate(get("date")) || new Date().toISOString().slice(0, 10),
        document_no: get("document_no"),
        platform,
        entity,
        description: get("description"),
        debit, credit, amount,
        tds:    parseNum(get("tds")),
        status: get("status") || "Open",
      }
    })
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

type ActiveTab = TxType | "master"

export default function TransactionTabs({ onSave, saving }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("master")
  // Store each tab's grid as 2D string array — no fixed column count
  const [grids, setGrids] = useState<Record<TxType, string[][]>>(
    () => Object.fromEntries(TAB_CONFIG.map(t => [t.key, []])) as Record<TxType, string[][]>
  )
  const [msg, setMsg] = useState("")

  const tab = TAB_CONFIG.find(t => t.key === activeTab)

  const handleSave = async () => {
    const allTxs: Transaction[] = []
    for (const t of TAB_CONFIG) {
      const txs = gridToTx(grids[t.key], BASE_COLS, t.key)
      allTxs.push(...txs)
    }
    if (!allTxs.length) { setMsg("No data to save."); return }
    await onSave(allTxs)
    setMsg(`✓ ${allTxs.length} rows saved`)
    setTimeout(() => setMsg(""), 3000)
  }

  const tabBar = (
    <div className="flex overflow-x-auto border-b border-slate-200">
      {/* Master */}
      <button
        onClick={() => setActiveTab("master")}
        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
          activeTab === "master"
            ? "border-violet-600 text-violet-700 bg-violet-50"
            : "border-transparent text-slate-500 hover:text-violet-600"
        }`}
      >
        ⚡ Master Paste
      </button>
      <div className="w-px bg-slate-200 my-2 mx-1" />
      {TAB_CONFIG.map(t => (
        <button
          key={t.key}
          onClick={() => setActiveTab(t.key)}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTab === t.key
              ? t.arSide
                ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                : "border-rose-500 text-rose-700 bg-rose-50"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.icon} {t.label}
          {grids[t.key].length > 0 && (
            <span className="ml-1 bg-slate-200 text-slate-600 text-xs rounded-full px-1.5">
              {grids[t.key].length}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {tabBar}
      <div className="p-4">
        {activeTab === "master" ? (
          <MasterInput onSave={onSave} saving={saving} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">
                {tab?.icon} {tab?.desc}.{" "}
                <span className="text-slate-400">Ctrl+V to paste from Zoho — platform auto-detected from Entity column.</span>
              </p>
              <div className="flex items-center gap-2">
                {msg && <span className="text-sm text-emerald-600 font-medium">{msg}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "⚡ Save All to DB"}
                </button>
              </div>
            </div>
            <VirtualGrid
              cols={BASE_COLS}
              rows={grids[activeTab as TxType]}
              onRowsChange={r => setGrids(prev => ({ ...prev, [activeTab]: r }))}
              headerClass={
                tab?.arSide
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-800"
              }
              visibleRows={35}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function parseNum(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[₹,\s()]/g, "")) || 0
}

function normalizeDate(s: string): string {
  if (!s) return ""
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? "20" + dmy[3] : dmy[3]
    return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const n = parseInt(s)
  if (n > 40000 && n < 60000) {
    return new Date((n - 25569) * 86400 * 1000).toISOString().slice(0, 10)
  }
  return s
}
