"use client"
import { useState, useCallback, useRef } from "react"
import { detectPlatform, } from "@/lib/platforms"
import { getSupabase } from "@/lib/supabase"
import type { Transaction, TxType } from "@/lib/supabase"

// ── Zoho column matchers — covers every common Zoho Books export column ──────
const MATCHERS: Record<string, string[]> = {
  // Party / header
  entity:           ["customer name","vendor name","supplier name","party name","bill to","customer","vendor","entity","client","contact name"],
  date:             ["invoice date","bill date","date","created time","created date","txn date","transaction date"],
  document_no:      ["invoice#","invoice #","invoice number","invoice no","bill#","bill no","bill number","doc no","voucher no","reference#","ref no"],
  invoice_no:       ["invoice#","invoice #","invoice number","invoice no"],
  order_number:     ["order number","po number","purchase order","order#","sales order"],
  subject:          ["subject","invoice subject","description of supply"],
  due_date:         ["due date","payment due","due by","due on"],
  payment_date:     ["payment date","paid date","date of payment"],
  payment_terms:    ["payment terms","terms","net days"],
  status:           ["invoice status","payment status","status","state"],
  // GST / compliance
  gstin:            ["gstin","gst identification","gst number","vendor gstin","customer gstin"],
  gst_treatment:    ["gst treatment","tax treatment"],
  place_of_supply:  ["place of supply","supply state","destination state"],
  reverse_charge:   ["reverse charge","rcm"],
  // Address & parties
  billing_address:  ["billing address","bill to address","invoice address"],
  shipping_address: ["shipping address","ship to","delivery address"],
  sales_person:     ["sales person","salesperson","sales rep","handled by"],
  branch:           ["branch","location","warehouse"],
  account:          ["account","ledger account","account name"],
  currency:         ["currency","currency code"],
  exchange_rate:    ["exchange rate","forex rate"],
  // Line item
  item_name:        ["item name","product name","service name","item","product","service"],
  item_description: ["item description","product description","description"],
  item_sku:         ["sku","item sku","product code","item code"],
  item_unit:        ["unit","uom","unit of measure"],
  hsn_sac:          ["hsn/sac","hsn code","sac code","hsn","sac"],
  qty:              ["quantity","qty","units","no. of units","quantity ordered"],
  rate:             ["rate","unit price","selling price","price","rate/item","unit rate"],
  discount:         ["item discount","discount amount","discount %","discount"],
  // Tax per line
  item_tax_name:    ["item tax name","tax name","gst name","tax type"],
  item_tax_pct:     ["item tax %","tax %","tax rate","gst %","igst %","cgst %","sgst %"],
  item_tax_amount:  ["item tax amount","tax amount","line tax"],
  // Totals
  sub_total:        ["sub total","subtotal","taxable amount","taxable value"],
  total_tax:        ["total tax","tax total","total gst"],
  adjustment:       ["adjustment","rounding","round off"],
  total:            ["total","invoice total","grand total","bill total","net total"],
  balance_due:      ["balance due","amount due","outstanding","balance"],
  igst:             ["igst amount","igst","integrated tax"],
  cgst:             ["cgst amount","cgst","central tax"],
  sgst:             ["sgst amount","sgst","utgst amount","utgst","state tax"],
  cess:             ["cess amount","cess","additional tax"],
  tds:              ["tds","tax deducted","withholding tax","tcs"],
  amount:           ["item total","item amount","line total","amount","net amount","value"],
  debit:            ["debit","dr","dr amount"],
  credit:           ["credit","cr","cr amount"],
  // Notes
  notes:            ["notes","customer notes","remarks","narration","memo"],
  terms:            ["terms","terms & conditions","terms and conditions"],
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

const FREEZE_DATE = "2026-03-31"   // FY 2025-26 cutoff
const LIVE_FROM   = "1 Apr 2026"   // display label

export default function FileUpload({ onSave }: Props) {
  const [txType,   setTxType]   = useState<TxType>("sales_invoice")
  const [dragging, setDragging] = useState(false)
  const [parsing,  setParsing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
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

      // Parse each row as a line item — store ALL columns in raw_data
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

          // Store EVERY original column — nothing lost for future reporting
          const raw_data: Record<string, string> = {}
          headers.forEach((h, i) => {
            if (h) raw_data[h] = row[i]?.toString() ?? ""
          })

          return {
            type:             txType,
            date:             normDate(g("date")) || new Date().toISOString().slice(0,10),
            due_date:         normDate(g("due_date")) || undefined,
            payment_date:     normDate(g("payment_date")) || undefined,
            document_no:      g("document_no") || g("invoice_no"),
            invoice_no:       g("invoice_no") || g("document_no"),
            order_number:     g("order_number"),
            subject:          g("subject"),
            status:           g("status") || "Open",
            payment_terms:    g("payment_terms"),
            platform:         detectPlatform(entity) || "Other",
            entity,
            gstin:            g("gstin"),
            gst_treatment:    g("gst_treatment"),
            place_of_supply:  g("place_of_supply"),
            reverse_charge:   g("reverse_charge"),
            billing_address:  g("billing_address"),
            shipping_address: g("shipping_address"),
            sales_person:     g("sales_person"),
            branch:           g("branch"),
            account:          g("account"),
            currency:         g("currency") || "INR",
            exchange_rate:    parseNum(g("exchange_rate")) || 1,
            item_name:        g("item_name"),
            item_description: g("item_description"),
            item_sku:         g("item_sku"),
            item_unit:        g("item_unit"),
            description:      g("item_description") || g("item_name"),
            hsn_sac:          g("hsn_sac"),
            qty,
            rate,
            discount,
            sub_total:        parseNum(g("sub_total")),
            total_tax:        parseNum(g("total_tax")),
            adjustment:       parseNum(g("adjustment")),
            total:            parseNum(g("total")),
            balance_due:      parseNum(g("balance_due")),
            debit,
            credit,
            amount,
            igst,
            cgst,
            sgst,
            cess:             parseNum(g("cess")),
            tds,
            item_tax_name:    g("item_tax_name"),
            item_tax_pct:     parseNum(g("item_tax_pct")),
            item_tax_amount:  parseNum(g("item_tax_amount")),
            notes:            g("notes"),
            terms:            g("terms"),
            raw_data,         // ← every original column preserved regardless
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
    setSaving(true)
    try {
      const db    = getSupabase()
      const label = TX_TYPES.find(t=>t.key===txType)?.label
      const txs   = result.txs

      // Split: frozen (historical) vs live
      const live       = txs.filter(t => t.date > FREEZE_DATE)
      const frozen     = txs.filter(t => t.date <= FREEZE_DATE)
      const frozenRows = frozen.length

      // 1. Delete only live records for this type (frozen rows untouched)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (db.from("pp_transactions") as any)
        .delete().eq("type", txType).gt("date", FREEZE_DATE)
      if (delErr) throw new Error(delErr.message)

      // 2. Insert frozen rows (historical — only on first load, won't duplicate due to delete skip)
      const CHUNK = 50
      const toInsert = [...frozen, ...live]
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        setMsg(`Saving… ${Math.min(i + CHUNK, toInsert.length)} / ${toInsert.length} rows`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db.from("pp_transactions") as any).insert(toInsert.slice(i, i + CHUNK))
        if (error) throw new Error(error.message)
      }

      const frozenNote = frozenRows > 0 ? ` (${frozenRows} historical rows ≤ 31-Mar-26 also stored as frozen)` : ""
      setMsg(`✓ ${toInsert.length} rows saved — all columns preserved.${frozenNote} Previous ${label} (live) data replaced.`)
      setResult(null); setFileName("")
      onSave([])
      setTimeout(() => setMsg(""), 6000)
    } catch(e: unknown) {
      setErr("Save failed: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
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
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">🔒 FY 2025-26 frozen</span>
              <span className="text-slate-400">Data ≤ 31-Mar-26 is protected. Uploads only update {LIVE_FROM} onwards.</span>
            </div>
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
