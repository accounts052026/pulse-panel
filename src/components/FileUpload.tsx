"use client"
import { useState, useCallback, useRef } from "react"
import { detectPlatform } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

// ── Zoho item-level column matchers ──────────────────────────
// Each entry: field name → list of possible header substrings (lowercase)
const MATCHERS: Record<string, string[]> = {
  // Header-level
  entity:       ["customer name","vendor name","supplier name","party name","bill to","customer","vendor","entity","client","contact"],
  date:         ["invoice date","bill date","date","created time","created date","txn date"],
  document_no:  ["invoice#","invoice #","invoice number","invoice no","bill#","bill no","bill number","doc no","voucher no","reference#"],
  invoice_no:   ["invoice#","invoice #","invoice number","invoice no"],
  due_date:     ["due date","payment due","due by"],
  status:       ["invoice status","payment status","status","state"],
  // Item-level
  item_name:    ["item name","product name","service name","item description","item","product","service","description","particulars"],
  hsn_sac:      ["hsn/sac","hsn code","sac code","hsn","sac"],
  qty:          ["quantity","qty","units","no. of units"],
  rate:         ["rate","unit price","selling price","price","rate/item"],
  discount:     ["item discount","discount amount","discount"],
  // Tax
  igst:         ["igst amount","igst","integrated tax","integrated gst"],
  cgst:         ["cgst amount","cgst","central tax","central gst"],
  sgst:         ["sgst amount","sgst","utgst amount","utgst","state tax","state gst"],
  tds:          ["tds","tax deducted","withholding tax","tcs"],
  // Amounts
  amount:       ["item total","item amount","line total","total","sub total","amount","net amount","value","taxable amount"],
  debit:        ["debit","dr"],
  credit:       ["credit","cr"],
}

const TX_TYPES: { key: TxType; label: string; icon: string; ar: boolean }[] = [
  { key: "sales_invoice",    label: "Sales Invoice",     icon: "🧾", ar: true  },
  { key: "credit_note",      label: "Credit Note",       icon: "📝", ar: true  },
  { key: "payment_received", label: "Payments Received", icon: "💰", ar: true  },
  { key: "bill_received",    label: "Bills Received",    icon: "📄", ar: false },
  { key: "vendor_credit",    label: "Vendor Credits",    icon: "🔄", ar: false },
  { key: "payment_made",     label: "Payments Made",     icon: "💸", ar: false },
]

// ── Helpers ───────────────────────────────────────────────────
function detectCol(headers: string[], keys: string[]): number {
  const lh = headers.map(h => h.toLowerCase().trim())
  for (const key of keys) {
    const idx = lh.findIndex(h => h === key || h.includes(key))
    if (idx >= 0) return idx
  }
  return -1
}
function parseNum(s?: string | number): number {
  if (typeof s === "number") return isNaN(s) ? 0 : s
  return parseFloat((s ?? "").toString().replace(/[₹$,\s()]/g, "")) || 0
}
function normDate(s?: string): string {
  if (!s) return ""
  const str = s.toString().trim()
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) { const y = dmy[3].length===2 ? "20"+dmy[3] : dmy[3]; return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}` }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10)
  const n = parseInt(str); if (n>40000&&n<60000) return new Date((n-25569)*86400*1000).toISOString().slice(0,10)
  const d = new Date(str); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  return str
}

interface ParseResult {
  headers:        string[]
  previewRows:    string[][]
  colMap:         Record<string, number>
  txs:            Transaction[]
  platformCounts: { platform: string; count: number }[]
  totalAmount:    number
  sheetName:      string
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

export default function FileUpload({ onSave, saving }: Props) {
  const [txType,   setTxType]   = useState<TxType>("sales_invoice")
  const [dragging, setDragging] = useState(false)
  const [parsing,  setParsing]  = useState(false)
  const [result,   setResult]   = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState("")
  const [msg,      setMsg]      = useState("")
  const [err,      setErr]      = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setErr(""); setMsg(""); setResult(null)
    setParsing(true)
    setFileName(file.name)

    try {
      const XLSX = await import("xlsx")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let workbook: any

      // ── Parse one workbook into {headers, dataRows} ──────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseWorkbook = (wb: any) => {
        const wsName = wb.SheetNames[0]
        const ws     = wb.Sheets[wsName]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:"", raw:false }) as string[][]
        let hi = 0
        for (let i = 0; i < Math.min(15, raw.length); i++) {
          if (raw[i].filter(c => c?.toString().trim()).length >= 4) { hi = i; break }
        }
        const headers  = raw[hi].map(h => h?.toString().trim() ?? "")
        const dataRows = raw.slice(hi+1).filter(r => r.some(c => c?.toString().trim()))
        return { headers, dataRows, sheetName: wsName }
      }

      // Collect all {headers, dataRows} across files
      let allParsed: { headers: string[]; dataRows: string[][]; sheetName: string }[] = []

      if (file.name.toLowerCase().endsWith(".zip")) {
        const JSZip   = (await import("jszip")).default
        const zip     = await JSZip.loadAsync(file)
        const xlsFiles = Object.keys(zip.files).filter(f => /\.(xlsx|xls)$/i.test(f) && !zip.files[f].dir)
        if (!xlsFiles.length) { setErr("No Excel files found inside the ZIP."); setParsing(false); return }
        for (const xlsFile of xlsFiles) {
          const buf = await zip.files[xlsFile].async("arraybuffer")
          const wb  = XLSX.read(buf, { type:"array", cellDates:true, raw:false })
          allParsed.push(parseWorkbook(wb))
        }
      } else if (/\.csv$/i.test(file.name)) {
        const text = await file.text()
        const wb   = XLSX.read(text, { type:"string" })
        allParsed.push(parseWorkbook(wb))
      } else {
        const buf = await file.arrayBuffer()
        const wb  = XLSX.read(buf, { type:"array", cellDates:true, raw:false })
        allParsed.push(parseWorkbook(wb))
      }

      // Use headers from first file; merge all dataRows
      const headers  = allParsed[0].headers
      const dataRows = allParsed.flatMap(p => p.dataRows)
      const sheetName = allParsed.length > 1
        ? `${allParsed.length} files merged`
        : allParsed[0].sheetName

      // Build column map
      const cm = Object.fromEntries(
        Object.entries(MATCHERS).map(([f,keys]) => [f, detectCol(headers, keys)])
      )

      // Parse each row as a line item
      const txs: Transaction[] = dataRows
        .map(row => {
          const g  = (f: string): string => cm[f]>=0 ? (row[cm[f]]?.toString().trim() ?? "") : ""
          const gn = (f: string): number => parseNum(g(f))

          const entity   = g("entity")
          const qty      = gn("qty")
          const rate     = gn("rate")
          const discount = gn("discount")
          const igst     = gn("igst")
          const cgst     = gn("cgst")
          const sgst     = gn("sgst")
          const tds      = gn("tds")
          const debit    = gn("debit")
          const credit   = gn("credit")

          // Amount: prefer explicit item total, else qty×rate, else debit/credit
          let amount = gn("amount")
          if (!amount && qty && rate) amount = qty * rate - discount
          if (!amount) amount = Math.abs(debit - credit) || debit || credit

          return {
            type:        txType,
            date:        normDate(g("date")) || new Date().toISOString().slice(0,10),
            document_no: g("document_no") || g("invoice_no"),
            invoice_no:  g("invoice_no") || g("document_no"),
            due_date:    normDate(g("due_date")) || undefined,
            platform:    detectPlatform(entity) || "Other",
            entity,
            item_name:   g("item_name"),
            description: g("item_name") || g("entity"),   // fallback
            hsn_sac:     g("hsn_sac"),
            qty,
            rate,
            discount,
            debit,
            credit,
            amount,
            igst,
            cgst,
            sgst,
            tds,
            status:      g("status") || "Open",
          } as Transaction
        })
        .filter(t => t.entity || t.document_no || t.amount || t.item_name)

      // Platform counts
      const counts: Record<string, number> = {}
      txs.forEach(t => { counts[t.platform!] = (counts[t.platform!]??0)+1 })

      const totalAmount = txs.reduce((s,t) => s + (t.amount||0), 0)

      setResult({
        headers,
        previewRows: dataRows.slice(0,5).map(r => headers.map((_,i) => r[i]?.toString() ?? "")),
        colMap: cm,
        txs,
        platformCounts: Object.entries(counts).map(([platform,count])=>({platform,count})),
        totalAmount,
        sheetName: sheetName ?? allParsed[0]?.sheetName ?? file.name,
      })
      setMsg(`✓ ${txs.length} line items parsed from ${allParsed.length > 1 ? `${allParsed.length} files` : `"${allParsed[0].sheetName}"`}`)
    } catch(e: unknown) {
      setErr("Parse error: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setParsing(false)
    }
  }, [txType])

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return
    const f = files[0]
    if (!/\.(zip|xlsx|xls|csv)$/i.test(f.name)) { setErr("Upload a .zip, .xlsx, .xls, or .csv file."); return }
    processFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer.files)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processFile])

  const handleSave = async () => {
    if (!result?.txs.length) return
    // Delete old records for this type, insert new
    await fetch(`/api/transactions?type=${txType}`, { method: "DELETE" })
    await onSave(result.txs)
    const label = TX_TYPES.find(t=>t.key===txType)?.label
    setMsg(`✓ ${result.txs.length} rows saved. Previous ${label} data cleared and replaced.`)
    setResult(null); setFileName("")
    setTimeout(()=>setMsg(""), 5000)
  }

  const reset = () => {
    setResult(null); setFileName(""); setMsg(""); setErr("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const selectedType = TX_TYPES.find(t=>t.key===txType)!
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 })

  // Which fields were successfully mapped
  const mappedFields  = result ? Object.entries(result.colMap).filter(([,i])=>i>=0) : []
  const missingFields = result ? Object.entries(result.colMap).filter(([,i])=>i<0).map(([f])=>f) : []

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-slate-800">Upload Zoho Export</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload .zip or .xlsx from Zoho — reads item-level rows, auto-maps columns, replaces existing data.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={txType}
              onChange={e => { setTxType(e.target.value as TxType); reset() }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>
            {result && (
              <>
                <button onClick={reset} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700">
                  ✕ Clear
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40">
                  {saving ? "Saving…" : `⚡ Replace & Save ${result.txs.length} rows`}
                </button>
              </>
            )}
          </div>
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-600 font-medium">{msg}</p>}
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          onClick={()=>fileRef.current?.click()}
          className={`bg-white rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center min-h-52 ${
            dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 hover:border-violet-400"
          }`}
        >
          <input ref={fileRef} type="file" accept=".zip,.xlsx,.xls,.csv" className="hidden"
            onChange={e=>handleFiles(e.target.files)} />
          {parsing ? (
            <div className="text-center">
              <div className="text-3xl mb-2 animate-pulse">⚙️</div>
              <div className="text-slate-600 font-semibold">Parsing {fileName}…</div>
              <div className="text-slate-400 text-sm mt-1">Reading item-level rows and columns</div>
            </div>
          ) : (
            <div className="text-center pointer-events-none select-none px-6">
              <div className="text-4xl mb-3">{selectedType.icon}</div>
              <div className="text-slate-700 font-semibold text-base">Drop {selectedType.label} export here</div>
              <div className="text-slate-400 text-sm mt-1">or click to browse</div>
              <div className="mt-4 flex gap-2 justify-center text-xs text-slate-400">
                {[".zip",".xlsx",".xls",".csv"].map(ext=>(
                  <span key={ext} className="bg-slate-100 rounded px-2 py-1">{ext}</span>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Reads item name · qty · rate · HSN/SAC · IGST · CGST · SGST · discount per line
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Line Items</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{result.txs.length}</div>
              <div className="text-xs text-slate-400">from {result.sheetName}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Value</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{fmt(result.totalAmount)}</div>
              <div className="text-xs text-slate-400">sum of amounts</div>
            </div>
            {result.platformCounts.map(({platform,count}) => (
              <div key={platform} className={`rounded-xl border px-4 py-3 shadow-sm ${platform==="Other"?"bg-amber-50 border-amber-200":"bg-white border-slate-200"}`}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${platform==="Other"?"text-amber-600":"text-slate-500"}`}>{platform}</div>
                <div className={`text-2xl font-bold mt-1 ${platform==="Other"?"text-amber-700":"text-slate-800"}`}>{count}</div>
                <div className="text-xs text-slate-400">rows</div>
              </div>
            ))}
          </div>

          {/* Column mapping */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Column mapping — {mappedFields.length} of {Object.keys(result.colMap).length} fields detected
            </div>
            <div className="flex flex-wrap gap-2">
              {mappedFields.map(([field, idx]) => (
                <span key={field} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700">
                  <span className="text-violet-600 font-semibold">{field}</span>
                  {` ← "${result.headers[idx as number]}"`}
                </span>
              ))}
              {missingFields.map(f => (
                <span key={f} className="bg-slate-100 rounded-lg px-2 py-1 text-xs text-slate-400">{f}: —</span>
              ))}
            </div>
          </div>

          {/* Preview table — key item-level columns only */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Preview — first 5 of {result.txs.length} line items
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedType.ar?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-600"}`}>
                {selectedType.icon} {selectedType.label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {["Platform","Date","Invoice#","Entity","Item Name","HSN/SAC","Qty","Rate","Discount","IGST","CGST","SGST","Amount","Status"].map(h=>(
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.txs.slice(0,5).map((t,ri)=>(
                    <tr key={ri} className={ri%2===0?"bg-white":"bg-slate-50/50"}>
                      <td className="px-3 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.platform==="Other"?"bg-amber-100 text-amber-700":"bg-violet-100 text-violet-700"}`}>{t.platform}</span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{t.date}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{t.invoice_no||t.document_no||"—"}</td>
                      <td className="px-3 py-1.5 max-w-[140px] truncate text-slate-600">{t.entity}</td>
                      <td className="px-3 py-1.5 max-w-[140px] truncate text-slate-600">{t.item_name||"—"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{t.hsn_sac||"—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600">{t.qty||"—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600">{t.rate ? fmt(t.rate) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{t.discount ? fmt(t.discount) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{t.igst ? fmt(t.igst) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{t.cgst ? fmt(t.cgst) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{t.sgst ? fmt(t.sgst) : "—"}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{fmt(t.amount)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.status==="Paid"?"bg-emerald-100 text-emerald-700":t.status==="Open"||t.status==="Sent"?"bg-blue-100 text-blue-700":"bg-slate-100 text-slate-600"}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
