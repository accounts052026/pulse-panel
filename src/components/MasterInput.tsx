"use client"
import { useState, useCallback } from "react"
import { detectPlatform, PLATFORMS } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

// ── Column auto-detection keywords ──────────────────────────
const MATCHERS: Record<string, string[]> = {
  entity:      ["entity", "party", "customer", "vendor", "name", "client", "contact", "account"],
  date:        ["date", "dt", "invoice date", "bill date", "txn date", "transaction date"],
  document_no: ["invoice no", "invoice number", "doc no", "document", "voucher", "bill no", "receipt", "ref"],
  description: ["description", "narration", "particulars", "remarks", "notes", "details"],
  debit:       ["debit", " dr ", "dr amount", "debit amount"],
  credit:      ["credit", " cr ", "cr amount", "credit amount"],
  amount:      ["amount", "net amount", "total", "value", "net"],
  tds:         ["tds", "tax deducted"],
  status:      ["status", "state", "payment status"],
}

function detectColIndex(headers: string[], keys: string[]): number {
  const lh = headers.map(h => h.toLowerCase().trim())
  for (const key of keys) {
    const i = lh.findIndex(h => h.includes(key.trim()))
    if (i >= 0) return i
  }
  return -1
}

function buildColMap(headers: string[]) {
  return Object.fromEntries(
    Object.entries(MATCHERS).map(([field, keys]) => [field, detectColIndex(headers, keys)])
  ) as Record<string, number>
}

interface ParsedRow {
  raw: string[]
  platform: string
  mapped: Partial<Record<string, string>>
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

const TX_TYPES: { key: TxType; label: string }[] = [
  { key: "sales_invoice",    label: "Sales Invoice"    },
  { key: "credit_note",      label: "Credit Note"      },
  { key: "payment_received", label: "Payment Received" },
  { key: "bill_received",    label: "Bill Received"    },
  { key: "vendor_credit",    label: "Vendor Credit"    },
  { key: "payment_made",     label: "Payment Made"     },
]

export default function MasterInput({ onSave, saving }: Props) {
  const [headers, setHeaders]     = useState<string[]>([])
  const [parsed,  setParsed]      = useState<ParsedRow[]>([])
  const [colMap,  setColMap]      = useState<Record<string, number>>({})
  const [txType,  setTxType]      = useState<TxType>("sales_invoice")
  const [msg,     setMsg]         = useState("")
  const [pasted,  setPasted]      = useState(false)

  // ── Parse pasted text ───────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    processText(text)
  }, [])

  const processText = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) { setMsg("Paste needs at least a header row + 1 data row."); return }

    // Detect delimiter (tab or comma)
    const delim = lines[0].includes("\t") ? "\t" : ","
    const hdrs  = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ""))
    const cm    = buildColMap(hdrs)

    const rows: ParsedRow[] = lines.slice(1).map(line => {
      const cells = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ""))
      const entityVal = cm.entity >= 0 ? (cells[cm.entity] ?? "") : ""
      const platform  = detectPlatform(entityVal) || "Other"
      const mapped: Partial<Record<string, string>> = {}
      Object.entries(cm).forEach(([field, idx]) => {
        if (idx >= 0) mapped[field] = cells[idx] ?? ""
      })
      return { raw: cells, platform, mapped }
    })

    setHeaders(hdrs)
    setColMap(cm)
    setParsed(rows)
    setPasted(true)
    setMsg("")
  }

  // ── Platform summary ─────────────────────────────────────
  const platformCounts = PLATFORMS.slice(0, -1).map(p => ({
    platform: p,
    count: parsed.filter(r => r.platform === p).length,
  })).filter(p => p.count > 0)

  const otherCount = parsed.filter(r => r.platform === "Other").length

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!parsed.length) { setMsg("No data to save."); return }

    const txs: Transaction[] = parsed
      .filter(r => r.mapped.entity || r.mapped.amount || r.mapped.document_no)
      .map(r => ({
        type:        txType,
        date:        normalizeDate(r.mapped.date ?? "") || new Date().toISOString().slice(0, 10),
        document_no: r.mapped.document_no ?? "",
        platform:    r.platform,
        entity:      r.mapped.entity ?? "",
        description: r.mapped.description ?? "",
        debit:       parseNum(r.mapped.debit),
        credit:      parseNum(r.mapped.credit),
        amount:      parseNum(r.mapped.amount) || Math.abs(parseNum(r.mapped.debit) - parseNum(r.mapped.credit)),
        tds:         parseNum(r.mapped.tds),
        status:      r.mapped.status || "Open",
      }))

    await onSave(txs)
    setMsg(`✓ ${txs.length} rows saved across ${platformCounts.length} platforms`)
    setTimeout(() => setMsg(""), 4000)
  }

  const reset = () => { setHeaders([]); setParsed([]); setPasted(false); setMsg("") }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Master Paste — Auto Bifurcation</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste your full Zoho export (any columns, any order). Platform auto-detected from Entity Name. No manual mapping needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={txType}
              onChange={e => setTxType(e.target.value as TxType)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {pasted && (
              <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 border border-slate-200 rounded-lg">
                ✕ Clear
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !pasted}
              className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : `⚡ Save ${parsed.length ? parsed.length + " rows" : ""}`}
            </button>
          </div>
        </div>
        {msg && <div className="mt-2 text-sm text-emerald-600 font-medium">{msg}</div>}
      </div>

      {/* Paste Zone */}
      {!pasted ? (
        <div
          onPaste={handlePaste}
          className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-violet-400 transition-colors flex flex-col items-center justify-center min-h-64 cursor-text focus:outline-none focus:border-violet-500"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          onInput={e => {
            const text = (e.currentTarget as HTMLDivElement).innerText
            if (text.includes("\t") || text.split("\n").length > 2) {
              processText(text);
              (e.currentTarget as HTMLDivElement).innerText = ""
            }
          }}
        >
          <div className="text-center pointer-events-none select-none">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-slate-600 font-semibold">Click here, then Ctrl+V</div>
            <div className="text-slate-400 text-sm mt-1">Paste your full Zoho export — any format, any columns</div>
            <div className="text-slate-400 text-xs mt-3 space-y-0.5">
              <div>✓ Tab-separated or CSV</div>
              <div>✓ Thousands of rows supported</div>
              <div>✓ Platform auto-detected from Entity Name</div>
              <div>✓ Columns auto-mapped (Date, Amount, Dr, Cr, Status…)</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Platform Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {platformCounts.map(({ platform, count }) => (
              <div key={platform} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{platform}</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{count}</div>
                <div className="text-xs text-slate-400">rows detected</div>
              </div>
            ))}
            {otherCount > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 px-4 py-3 shadow-sm">
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wide">Unmatched</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">{otherCount}</div>
                <div className="text-xs text-amber-500">entity not recognised</div>
              </div>
            )}
          </div>

          {/* Column Mapping Info */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Auto-detected column mapping</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(colMap).map(([field, idx]) => (
                idx >= 0 ? (
                  <span key={field} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700">
                    <span className="text-violet-600 font-semibold">{field}</span>
                    {" ← "}
                    <span className="text-slate-500">"{headers[idx]}"</span>
                  </span>
                ) : (
                  <span key={field} className="bg-slate-100 rounded-lg px-2 py-1 text-xs text-slate-400">
                    {field}: not found
                  </span>
                )
              ))}
            </div>
          </div>

          {/* Preview Table — dynamic columns */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Preview — first 50 of {parsed.length} rows</span>
              <span className="text-xs text-slate-400">{headers.length} columns detected</span>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="text-xs w-full border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-violet-700 border-b border-slate-200 whitespace-nowrap">
                      Platform ⚡
                    </th>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.platform === "Other"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-violet-100 text-violet-700"
                        }`}>
                          {row.platform}
                        </span>
                      </td>
                      {row.raw.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-xs truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function parseNum(s?: string): number {
  if (!s) return 0
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/[()]/g, "")
  return parseFloat(cleaned) || 0
}

function normalizeDate(s: string): string {
  if (!s) return ""
  // Try DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? "20" + dmy[3] : dmy[3]
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // Excel serial number
  const n = parseInt(s)
  if (n > 40000 && n < 60000) {
    const d = new Date((n - 25569) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  return s
}
