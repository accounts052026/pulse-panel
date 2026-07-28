"use client"
import { useState, useCallback, useRef } from "react"
import { detectPlatform } from "@/lib/platforms"
import { getSupabase } from "@/lib/supabase"
import type { Transaction, TxType } from "@/lib/supabase"

// ── Auto-detect transaction type from filename ────────────────
const FREEZE_DATE = "2026-03-31"

function detectTxType(filename: string): TxType {
  const f = filename.toLowerCase()
  if (f.includes("vendor_payment") || f.includes("payment_made") || f.includes("vendor payment")) return "payment_made"
  if (f.includes("vendor_credit")  || f.includes("debit_note")   || f.includes("vendor credit"))  return "vendor_credit"
  if (f.includes("bill"))                                                                            return "bill_received"
  if (f.includes("customer_payment")|| f.includes("payment_received")|| f.includes("receipt"))     return "payment_received"
  if (f.includes("credit_note")    || f.includes("credit note"))                                    return "credit_note"
  if (f.includes("invoice")        || f.includes("sales"))                                          return "sales_invoice"
  return "sales_invoice"
}

const TX_LABELS: Record<TxType, { label: string; icon: string; ar: boolean }> = {
  sales_invoice:    { label: "Sales Invoice",     icon: "🧾", ar: true  },
  credit_note:      { label: "Credit Note",       icon: "📝", ar: true  },
  payment_received: { label: "Payment Received",  icon: "💰", ar: true  },
  bill_received:    { label: "Bill Received",      icon: "📄", ar: false },
  vendor_credit:    { label: "Vendor Credit",      icon: "🔄", ar: false },
  payment_made:     { label: "Payment Made",       icon: "💸", ar: false },
}

// ── Column matchers ────────────────────────────────────────────
const MATCHERS: Record<string, string[]> = {
  entity:           ["customer name","vendor name","supplier name","party name","bill to","customer","vendor","entity","client","contact name","payee"],
  date:             ["invoice date","bill date","payment date","date","created time","created date","txn date","transaction date"],
  document_no:      ["invoice#","invoice #","invoice number","invoice no","bill#","bill no","bill number","payment#","payment no","doc no","voucher no","reference#","ref no","credit note#","credit note number"],
  invoice_no:       ["invoice#","invoice #","invoice number","invoice no"],
  order_number:     ["order number","po number","purchase order","order#"],
  subject:          ["subject","invoice subject","description of supply"],
  due_date:         ["due date","payment due","due by"],
  payment_date:     ["payment date","paid date","date of payment"],
  payment_terms:    ["payment terms","terms","net days"],
  status:           ["invoice status","payment status","status","state"],
  gstin:            ["gstin","gst identification","gst number","vendor gstin","customer gstin"],
  gst_treatment:    ["gst treatment","tax treatment"],
  place_of_supply:  ["place of supply","supply state","destination state"],
  reverse_charge:   ["reverse charge","rcm"],
  billing_address:  ["billing address","bill to address"],
  shipping_address: ["shipping address","ship to","delivery address"],
  sales_person:     ["sales person","salesperson","sales rep"],
  branch:           ["branch","location","warehouse"],
  account:          ["account","ledger account","account name","payment account","paid through"],
  currency:         ["currency","currency code"],
  exchange_rate:    ["exchange rate","forex rate"],
  item_name:        ["item name","product name","service name","item","product","service"],
  item_description: ["item description","product description","description","particulars"],
  item_sku:         ["sku","item sku","product code","item code"],
  item_unit:        ["unit","uom","unit of measure"],
  hsn_sac:          ["hsn/sac","hsn code","sac code","hsn","sac"],
  qty:              ["quantity","qty","units","no. of units"],
  rate:             ["rate","unit price","selling price","price","rate/item"],
  discount:         ["item discount","discount amount","discount"],
  item_tax_name:    ["item tax name","tax name","gst name","tax type"],
  item_tax_pct:     ["item tax %","tax %","tax rate","gst %"],
  item_tax_amount:  ["item tax amount","tax amount","line tax"],
  sub_total:        ["sub total","subtotal","taxable amount","taxable value"],
  total_tax:        ["total tax","tax total","total gst"],
  adjustment:       ["adjustment","rounding","round off"],
  total:            ["total","invoice total","grand total","bill total","net total","amount","amount paid"],
  balance_due:      ["balance due","amount due","outstanding","balance"],
  igst:             ["igst amount","igst","integrated tax"],
  cgst:             ["cgst amount","cgst","central tax"],
  sgst:             ["sgst amount","sgst","utgst amount","utgst","state tax"],
  cess:             ["cess amount","cess"],
  tds:              ["tds","tax deducted","withholding tax","tcs"],
  amount:           ["item total","item amount","line total","amount","net amount","value","amount paid"],
  debit:            ["debit","dr","dr amount"],
  credit:           ["credit","cr","cr amount"],
  notes:            ["notes","customer notes","remarks","narration","memo"],
  terms:            ["terms","terms & conditions"],
}

// ── Helpers ────────────────────────────────────────────────────
function detectCol(headers: string[], keys: string[]): number {
  const lh = headers.map(h => h.toLowerCase().trim())
  for (const key of keys) {
    const i = lh.findIndex(h => h === key || h.includes(key))
    if (i >= 0) return i
  }
  return -1
}
function parseNum(s?: string | number) {
  if (typeof s === "number") return isNaN(s) ? 0 : s
  return parseFloat((s ?? "").toString().replace(/[₹$,\s()]/g, "")) || 0
}
function normDate(s?: string): string {
  if (!s) return ""
  const str = s.toString().trim()
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) { const y = dmy[3].length===2?"20"+dmy[3]:dmy[3]; return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}` }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10)
  const n = parseInt(str); if(n>40000&&n<60000) return new Date((n-25569)*86400*1000).toISOString().slice(0,10)
  const d = new Date(str); if(!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  return str
}

interface FileEntry {
  file:      File
  txType:    TxType
  status:    "pending" | "parsing" | "ready" | "saving" | "done" | "error"
  txs:       Transaction[]
  rowCount:  number
  msg:       string
  headers:   string[]
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
}

async function parseFile(file: File, txType: TxType): Promise<{ txs: Transaction[]; headers: string[] }> {
  const XLSX = await import("xlsx")

  let workbook: ReturnType<typeof XLSX.read>

  if (file.name.toLowerCase().endsWith(".zip")) {
    const JSZip   = (await import("jszip")).default
    const zip     = await JSZip.loadAsync(file)
    const xlsFile = Object.keys(zip.files).find(f => /\.(xlsx|xls)$/i.test(f) && !zip.files[f].dir)
    if (!xlsFile) throw new Error("No Excel inside ZIP")
    const buf = await zip.files[xlsFile].async("arraybuffer")
    workbook  = XLSX.read(buf, { type:"array", cellDates:true, raw:false })
  } else {
    const buf = await file.arrayBuffer()
    workbook  = XLSX.read(buf, { type:"array", cellDates:true, raw:false })
  }

  const ws  = workbook.Sheets[workbook.SheetNames[0]]
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:"", raw:false }) as string[][]

  let hi = 0
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    if (raw[i].filter(c => c?.toString().trim()).length >= 3) { hi = i; break }
  }

  const headers  = raw[hi].map(h => h?.toString().trim() ?? "")
  const dataRows = raw.slice(hi+1).filter(r => r.some(c => c?.toString().trim()))
  const cm       = Object.fromEntries(Object.entries(MATCHERS).map(([f,k])=>[f, detectCol(headers,k)]))
  const g        = (row: string[], f: string) => cm[f]>=0 ? (row[cm[f]]?.toString().trim()??"") : ""
  const gn       = (row: string[], f: string) => parseNum(g(row, f))

  const txs: Transaction[] = dataRows.map(row => {
    const entity = g(row,"entity")
    const qty    = gn(row,"qty"), rate = gn(row,"rate"), discount = gn(row,"discount")
    const debit  = gn(row,"debit"), credit = gn(row,"credit")
    let   amount = gn(row,"amount") || gn(row,"total")
    if (!amount && qty && rate) amount = qty*rate - discount
    if (!amount) amount = Math.abs(debit-credit)||debit||credit

    const raw_data: Record<string,string> = {}
    headers.forEach((h,i) => { if(h) raw_data[h] = row[i]?.toString()??"" })

    return {
      type:             txType,
      date:             normDate(g(row,"date")) || new Date().toISOString().slice(0,10),
      due_date:         normDate(g(row,"due_date")) || undefined,
      payment_date:     normDate(g(row,"payment_date")) || undefined,
      document_no:      g(row,"document_no") || g(row,"invoice_no"),
      invoice_no:       g(row,"invoice_no")  || g(row,"document_no"),
      order_number:     g(row,"order_number"),
      subject:          g(row,"subject"),
      status:           g(row,"status") || "Open",
      payment_terms:    g(row,"payment_terms"),
      platform:         detectPlatform(entity) || "Other",
      entity,
      gstin:            g(row,"gstin"),
      gst_treatment:    g(row,"gst_treatment"),
      place_of_supply:  g(row,"place_of_supply"),
      reverse_charge:   g(row,"reverse_charge"),
      billing_address:  g(row,"billing_address"),
      shipping_address: g(row,"shipping_address"),
      sales_person:     g(row,"sales_person"),
      branch:           g(row,"branch"),
      account:          g(row,"account"),
      currency:         g(row,"currency") || "INR",
      exchange_rate:    parseNum(g(row,"exchange_rate")) || 1,
      item_name:        g(row,"item_name"),
      item_description: g(row,"item_description"),
      item_sku:         g(row,"item_sku"),
      item_unit:        g(row,"item_unit"),
      description:      g(row,"item_description") || g(row,"item_name"),
      hsn_sac:          g(row,"hsn_sac"),
      qty, rate, discount,
      sub_total:        gn(row,"sub_total"),
      total_tax:        gn(row,"total_tax"),
      adjustment:       gn(row,"adjustment"),
      total:            gn(row,"total"),
      balance_due:      gn(row,"balance_due"),
      debit, credit, amount,
      igst:             gn(row,"igst"),
      cgst:             gn(row,"cgst"),
      sgst:             gn(row,"sgst"),
      cess:             gn(row,"cess"),
      tds:              gn(row,"tds"),
      item_tax_name:    g(row,"item_tax_name"),
      item_tax_pct:     gn(row,"item_tax_pct"),
      item_tax_amount:  gn(row,"item_tax_amount"),
      notes:            g(row,"notes"),
      terms:            g(row,"terms"),
      raw_data,
    } as Transaction
  }).filter(t => t.entity || t.document_no || t.amount || t.item_name)

  return { txs, headers }
}

export default function BulkImport({ onSave }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)
  const [globalMsg, setGlobalMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const upd = (i: number, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map((e, idx) => idx===i ? {...e,...patch} : e))

  const addFiles = useCallback(async (files: FileList) => {
    const newEntries: FileEntry[] = Array.from(files)
      .filter(f => /\.(zip|xlsx|xls|csv)$/i.test(f.name))
      .filter(f => !entries.find(e => e.file.name===f.name))
      .map(f => ({
        file: f, txType: detectTxType(f.name),
        status: "pending" as const, txs: [], rowCount: 0, msg: "", headers: [],
      }))
    if (!newEntries.length) return
    setEntries(prev => [...prev, ...newEntries])

    // Parse all new files
    for (let i = 0; i < newEntries.length; i++) {
      const idx = entries.length + i
      setEntries(prev => prev.map((e,j) => j===idx ? {...e, status:"parsing"} : e))
      try {
        const { txs, headers } = await parseFile(newEntries[i].file, newEntries[i].txType)
        setEntries(prev => prev.map((e,j) => j===idx ? {...e, status:"ready", txs, headers, rowCount:txs.length, msg:`${txs.length} rows`} : e))
      } catch(err: unknown) {
        setEntries(prev => prev.map((e,j) => j===idx ? {...e, status:"error", msg: String(err)} : e))
      }
    }
  }, [entries])

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); addFiles(e.dataTransfer.files) }

  const importAll = async () => {
    const ready = entries.filter(e => e.status==="ready" && e.txs.length)
    if (!ready.length) return
    setImporting(true)
    const db = getSupabase()
    let totalSaved = 0

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      if (e.status !== "ready") continue
      upd(i, { status:"saving", msg:"Deleting old…" })

      try {
        // Delete live records (post-freeze) for this type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db.from("pp_transactions") as any)
          .delete().eq("type", e.txType).gt("date", FREEZE_DATE)

        // Insert in 50-row batches
        const CHUNK = 50
        for (let c = 0; c < e.txs.length; c += CHUNK) {
          upd(i, { msg:`Saving ${Math.min(c+CHUNK, e.txs.length)}/${e.txs.length}…` })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (db.from("pp_transactions") as any).insert(e.txs.slice(c, c+CHUNK))
          if (error) throw new Error(error.message)
        }

        totalSaved += e.txs.length
        upd(i, { status:"done", msg:`✓ ${e.txs.length} rows saved` })
      } catch(err: unknown) {
        upd(i, { status:"error", msg:"Error: " + String(err) })
      }
    }

    setImporting(false)
    setGlobalMsg(`✓ Done — ${totalSaved} rows imported across ${ready.length} files`)
    onSave([])
    setTimeout(() => setGlobalMsg(""), 8000)
  }

  const readyCount = entries.filter(e=>e.status==="ready").length
  const fmt = (n: number) => n.toLocaleString("en-IN")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-slate-800">Bulk Import — Multiple Files</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drop all your Zoho exports at once. Type auto-detected from filename. All columns + raw data stored.
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">🔒 FY 2025-26 frozen</span>
              <span className="text-slate-400">Only data after 31-Mar-26 gets replaced on re-import.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
              + Add Files
            </button>
            {readyCount > 0 && (
              <button onClick={importAll} disabled={importing}
                className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40">
                {importing ? "Importing…" : `⚡ Import All (${readyCount} files)`}
              </button>
            )}
            {entries.length > 0 && !importing && (
              <button onClick={() => setEntries([])}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
        {globalMsg && <p className="mt-2 text-sm text-emerald-600 font-semibold">{globalMsg}</p>}
        <input ref={fileRef} type="file" multiple accept=".zip,.xlsx,.xls,.csv" className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)} />
      </div>

      {/* Drop zone */}
      {entries.length === 0 && (
        <div
          onDragOver={e=>{e.preventDefault()}}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-violet-400 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-48"
        >
          <div className="text-center pointer-events-none select-none px-6">
            <div className="text-4xl mb-3">📂</div>
            <div className="text-slate-700 font-semibold">Drop all Zoho export files here</div>
            <div className="text-slate-400 text-sm mt-1">or click to browse — select multiple files at once</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500 max-w-xs mx-auto">
              {Object.values(TX_LABELS).map(t => (
                <span key={t.label} className="bg-slate-50 border border-slate-200 rounded px-2 py-1">{t.icon} {t.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const meta = TX_LABELS[e.txType]
            const statusColor =
              e.status==="done"    ? "border-emerald-300 bg-emerald-50/30" :
              e.status==="error"   ? "border-rose-300   bg-rose-50/30"    :
              e.status==="saving"  ? "border-violet-300 bg-violet-50/30"  :
              e.status==="ready"   ? "border-slate-200  bg-white"         :
              e.status==="parsing" ? "border-amber-200  bg-amber-50/30"   :
                                     "border-slate-200  bg-white"

            return (
              <div key={e.file.name} className={`rounded-xl border ${statusColor} p-3 transition-all`}>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status icon */}
                  <div className="text-lg w-6 text-center shrink-0">
                    {e.status==="done"    ? "✅" :
                     e.status==="error"   ? "❌" :
                     e.status==="saving"  ? "⏳" :
                     e.status==="parsing" ? "🔄" :
                     e.status==="ready"   ? "✓"  : "⏸"}
                  </div>

                  {/* Filename */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{e.file.name}</div>
                    <div className="text-xs text-slate-400">{(e.file.size/1024).toFixed(0)} KB</div>
                  </div>

                  {/* Type selector */}
                  <select
                    value={e.txType}
                    disabled={importing || e.status==="done"}
                    onChange={async ev => {
                      const t = ev.target.value as TxType
                      upd(i, { txType:t, status:"parsing", txs:[], rowCount:0 })
                      try {
                        const { txs, headers } = await parseFile(e.file, t)
                        upd(i, { status:"ready", txs, headers, rowCount:txs.length, msg:`${txs.length} rows` })
                      } catch(err:unknown) { upd(i, { status:"error", msg:String(err) }) }
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-300"
                  >
                    {Object.entries(TX_LABELS).map(([k,v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>

                  {/* Badge */}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.ar?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-600"}`}>
                    {meta.icon} {meta.label}
                  </span>

                  {/* Row count */}
                  {e.rowCount > 0 && (
                    <span className="text-xs text-slate-500 shrink-0">{fmt(e.rowCount)} rows</span>
                  )}

                  {/* Remove */}
                  {!importing && e.status !== "done" && (
                    <button onClick={() => setEntries(prev=>prev.filter((_,j)=>j!==i))}
                      className="text-slate-400 hover:text-slate-600 text-sm shrink-0">✕</button>
                  )}
                </div>

                {/* Status message */}
                {e.msg && (
                  <div className={`mt-1 text-xs px-1 ${
                    e.status==="done"  ? "text-emerald-600 font-medium" :
                    e.status==="error" ? "text-rose-600" : "text-slate-500"
                  }`}>{e.msg}</div>
                )}
              </div>
            )
          })}

          {/* Drop more zone */}
          <div
            onDragOver={e=>e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border border-dashed border-slate-300 rounded-xl py-3 text-center text-xs text-slate-400 cursor-pointer hover:border-violet-400 hover:text-violet-500 transition-colors"
          >
            + Drop more files or click to add
          </div>
        </div>
      )}
    </div>
  )
}
