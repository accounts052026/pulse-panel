"use client"
import { useState } from "react"
import { detectPlatform } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

const TX_TYPES: { key: TxType; label: string }[] = [
  { key: "sales_invoice",    label: "Sales Invoice"    },
  { key: "credit_note",      label: "Credit Note"      },
  { key: "payment_received", label: "Payment Received" },
  { key: "bill_received",    label: "Bill Received"    },
  { key: "vendor_credit",    label: "Vendor Credit"    },
  { key: "payment_made",     label: "Payment Made"     },
]

const MATCHERS: Record<string, string[]> = {
  entity:      ["entity","party","customer","vendor","name","client","account"],
  date:        ["date","dt","invoice date","bill date","txn date"],
  document_no: ["invoice no","invoice number","doc no","document","voucher","bill no","ref"],
  description: ["description","narration","particulars","remarks","notes"],
  debit:       ["debit","dr","dr amount","debit amount"],
  credit:      ["credit","cr","cr amount","credit amount"],
  amount:      ["amount","net amount","total","value","net"],
  tds:         ["tds","tax deducted"],
  status:      ["status","state"],
}

function detectCol(headers: string[], keys: string[]): number {
  const lh = headers.map(h => h.toLowerCase().trim())
  for (const key of keys) {
    const i = lh.findIndex(h => h.includes(key.trim()))
    if (i >= 0) return i
  }
  return -1
}

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
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  const n = parseInt(s)
  if (n > 40000 && n < 60000) return new Date((n-25569)*86400*1000).toISOString().slice(0,10)
  return s
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

interface PreviewState {
  headers: string[]
  rows: string[][]
  colMap: Record<string, number>
  platformCounts: { platform: string; count: number }[]
  sheetUrl: string
}

export default function SheetImport({ onSave, saving }: Props) {
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1eAbBY9HXX-PAk3b-J2B6ExGy1ft37EZiWeIVNw9gpOU/edit")
  const [txType,   setTxType]   = useState<TxType>("sales_invoice")
  const [loading,  setLoading]  = useState(false)
  const [preview,  setPreview]  = useState<PreviewState | null>(null)
  const [msg,      setMsg]      = useState("")
  const [err,      setErr]      = useState("")

  const extractSheetId = (url: string) => {
    const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    return m ? m[1] : null
  }

  const handleImport = async () => {
    if (!sheetUrl.trim()) { setErr("Paste your Google Sheet URL first."); return }
    setLoading(true); setErr(""); setMsg("")
    try {
      const res = await fetch(`/api/import-sheet?url=${encodeURIComponent(sheetUrl)}`)
      if (!res.ok) { setErr((await res.json()).error); return }
      const csv = await res.text()

      // Parse CSV (handles comma-separated)
      const lines = csv.trim().split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setErr("Sheet appears empty."); return }

      const parseCSVLine = (line: string) => {
        const result: string[] = []; let cur = ""; let inQ = false
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ }
          else if (ch === "," && !inQ) { result.push(cur.trim()); cur = "" }
          else cur += ch
        }
        result.push(cur.trim())
        return result
      }

      const headers = parseCSVLine(lines[0])
      const rows    = lines.slice(1).map(parseCSVLine)
      const cm      = Object.fromEntries(
        Object.entries(MATCHERS).map(([f, keys]) => [f, detectCol(headers, keys)])
      )

      const counts: Record<string, number> = {}
      rows.forEach(row => {
        const entity = cm.entity >= 0 ? row[cm.entity] ?? "" : ""
        const p = detectPlatform(entity)
        counts[p] = (counts[p] ?? 0) + 1
      })

      setPreview({
        headers, rows, colMap: cm,
        platformCounts: Object.entries(counts).map(([platform, count]) => ({ platform, count })),
        sheetUrl,
      })
      setMsg(`✓ Loaded ${rows.length} rows from sheet`)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    const { rows, colMap } = preview
    const txs: Transaction[] = rows
      .filter(row => row.some(v => v?.trim()))
      .map(row => {
        const get = (f: string) => colMap[f] >= 0 ? row[colMap[f]] ?? "" : ""
        const entity  = get("entity")
        const debit   = parseNum(get("debit"))
        const credit  = parseNum(get("credit"))
        const amount  = parseNum(get("amount")) || Math.abs(debit - credit) || debit || credit
        return {
          type:        txType,
          date:        normalizeDate(get("date")) || new Date().toISOString().slice(0,10),
          document_no: get("document_no"),
          platform:    detectPlatform(entity) || "Other",
          entity,
          description: get("description"),
          debit, credit, amount,
          tds:    parseNum(get("tds")),
          status: get("status") || "Open",
        }
      })
    await onSave(txs)
    setMsg(`✓ ${txs.length} transactions saved to Supabase`)
    setPreview(null)
    setTimeout(() => setMsg(""), 4000)
  }

  const sheetId    = extractSheetId(sheetUrl)
  const openUrl    = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null

  return (
    <div className="space-y-4">
      {/* Input row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="font-bold text-slate-800 mb-1">Import from Google Sheets</h2>
        <p className="text-xs text-slate-500 mb-3">
          Share your sheet (Anyone with link → Viewer), paste the URL below, select transaction type, and click Import.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="url"
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 min-w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <select
            value={txType}
            onChange={e => setTxType(e.target.value as TxType)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 font-medium flex items-center gap-1">
              🔗 Open Sheet
            </a>
          )}
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? "Fetching…" : "↓ Import"}
          </button>
          {preview && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : `⚡ Save ${preview.rows.length} rows`}
            </button>
          )}
        </div>
        {err && <p className="text-rose-600 text-sm mt-2">{err}</p>}
        {msg && <p className="text-emerald-600 text-sm mt-2 font-medium">{msg}</p>}
      </div>

      {preview && (
        <>
          {/* Platform breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {preview.platformCounts.map(({ platform, count }) => (
              <div key={platform} className={`rounded-xl border px-4 py-3 shadow-sm ${
                platform === "Other" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
              }`}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${platform === "Other" ? "text-amber-600" : "text-slate-500"}`}>
                  {platform}
                </div>
                <div className={`text-2xl font-bold mt-1 ${platform === "Other" ? "text-amber-700" : "text-slate-800"}`}>
                  {count}
                </div>
                <div className="text-xs text-slate-400">rows</div>
              </div>
            ))}
          </div>

          {/* Column mapping */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Auto-detected columns</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.colMap).map(([field, idx]) => (
                <span key={field} className={`rounded-lg px-2 py-1 text-xs ${
                  idx >= 0
                    ? "bg-white border border-slate-200 text-slate-700"
                    : "bg-slate-100 text-slate-400"
                }`}>
                  <span className="text-violet-600 font-semibold">{field}</span>
                  {idx >= 0 ? ` ← "${preview.headers[idx]}"` : ": not found"}
                </span>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Preview — first 50 of {preview.rows.length} rows</span>
              <a href={preview.sheetUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                🔗 Open source sheet
              </a>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="text-xs w-full border-collapse">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-violet-700 border-b border-slate-200 whitespace-nowrap">Platform ⚡</th>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row, ri) => {
                    const entity   = preview.colMap.entity >= 0 ? row[preview.colMap.entity] ?? "" : ""
                    const platform = detectPlatform(entity) || "Other"
                    return (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            platform === "Other" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"
                          }`}>{platform}</span>
                        </td>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-xs truncate">{cell}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
