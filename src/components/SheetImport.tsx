"use client"
import { useState } from "react"
import { detectPlatform } from "@/lib/platforms"
import type { Transaction, TxType } from "@/lib/supabase"

// ── Config ────────────────────────────────────────────────────
const SHEET_ID = "1eAbBY9HXX-PAk3b-J2B6ExGy1ft37EZiWeIVNw9gpOU"
const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`

interface TabCfg {
  key:   TxType
  label: string
  icon:  string
  ar:    boolean
  hint:  string
}

const TABS: TabCfg[] = [
  { key: "sales_invoice",    label: "Sales Invoice",     icon: "🧾", ar: true,  hint: "Sales Invoice" },
  { key: "credit_note",      label: "Credit Note",       icon: "📝", ar: true,  hint: "Credit Note" },
  { key: "payment_received", label: "Payments Received", icon: "💰", ar: true,  hint: "Payments Received" },
  { key: "bill_received",    label: "Bills Received",    icon: "📄", ar: false, hint: "Bills Received" },
  { key: "vendor_credit",    label: "Vendor Credits",    icon: "🔄", ar: false, hint: "Vendor Credits" },
  { key: "payment_made",     label: "Payments Made",     icon: "💸", ar: false, hint: "Payments Made" },
]

const MATCHERS: Record<string, string[]> = {
  entity:      ["entity","party","customer","vendor","name","client","contact"],
  date:        ["date","dt","invoice date","bill date","txn date"],
  document_no: ["invoice no","invoice number","doc no","document","voucher","bill no","ref"],
  description: ["description","narration","particulars","remarks","notes"],
  debit:       ["debit"," dr ","dr amount","debit amount"],
  credit:      ["credit"," cr ","cr amount","credit amount"],
  amount:      ["amount","net amount","total","value","net"],
  tds:         ["tds","tax deducted"],
  status:      ["status","state","payment status"],
}

// ── Helpers ───────────────────────────────────────────────────
function detectCol(headers: string[], keys: string[]): number {
  const lh = headers.map(h => h.toLowerCase().trim())
  for (const key of keys) {
    const i = lh.findIndex(h => h.includes(key.trim()))
    if (i >= 0) return i
  }
  return -1
}
function parseNum(s?: string) { return parseFloat((s ?? "").replace(/[₹,\s()]/g,"")) || 0 }
function normDate(s: string): string {
  if (!s) return ""
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) { const y = dmy[3].length===2?"20"+dmy[3]:dmy[3]; return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}` }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  const n=parseInt(s); if(n>40000&&n<60000) return new Date((n-25569)*86400*1000).toISOString().slice(0,10)
  return s
}
function parseCSVLine(line: string): string[] {
  const r: string[] = []; let cur=""; let inQ=false
  for (const ch of line) {
    if (ch==='"') inQ=!inQ
    else if (ch===","&&!inQ){r.push(cur.trim());cur=""}
    else cur+=ch
  }
  r.push(cur.trim()); return r
}
function toExportUrl(url: string): string | null {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!m) return null
  const gidM = url.match(/[#&?]gid=(\d+)/)
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gidM?`&gid=${gidM[1]}`:""}`
}

// ── Per-tab state ─────────────────────────────────────────────
interface TabState {
  url:     string
  status:  "idle" | "fetching" | "preview" | "saving" | "done" | "error"
  msg:     string
  count:   number
  preview: { headers: string[]; rows: string[][] } | null
  parsed:  Transaction[] | null
}

function initState(url="") : TabState {
  return { url, status:"idle", msg:"", count:0, preview:null, parsed:null }
}

interface Props {
  onSave: (txs: Transaction[]) => Promise<void>
  saving: boolean
}

// ── Script popup ──────────────────────────────────────────────
const APPS_SCRIPT = `function setupPulsePanelTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ["Sales Invoice","Credit Note","Payments Received","Bills Received","Vendor Credits","Payments Made"];
  var headers = ["Date","Document No","Entity / Party","Description","Debit (Dr)","Credit (Cr)","Amount","TDS","Status"];
  var existing = ss.getSheets().map(function(s){return s.getName();});
  // rename first sheet
  if(existing[0] !== tabs[0]) ss.getSheets()[0].setName(tabs[0]);
  // create remaining
  for(var i=1;i<tabs.length;i++){
    if(existing.indexOf(tabs[i])===-1) ss.insertSheet(tabs[i]);
  }
  // set headers on all
  tabs.forEach(function(name){
    var sh = ss.getSheetByName(name);
    if(sh){
      sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight("bold");
    }
  });
  SpreadsheetApp.getUi().alert("Done! 6 tabs created with headers.");
}`

export default function SheetImport({ onSave, saving }: Props) {
  const [states, setStates] = useState<Record<TxType, TabState>>({
    sales_invoice:    initState(),
    credit_note:      initState(),
    payment_received: initState(),
    bill_received:    initState(),
    vendor_credit:    initState(),
    payment_made:     initState(),
  })
  const [showScript, setShowScript] = useState(false)
  const [copied,     setCopied]     = useState(false)

  const update = (key: TxType, patch: Partial<TabState>) =>
    setStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const handleImport = async (tab: TabCfg) => {
    const { url } = states[tab.key]
    if (!url.trim()) { update(tab.key, { status:"error", msg:"Paste the tab URL first." }); return }
    update(tab.key, { status:"fetching", msg:"Fetching from sheet…", preview:null, parsed:null })

    const exportUrl = toExportUrl(url)
    if (!exportUrl) { update(tab.key, { status:"error", msg:"Not a valid Google Sheets URL." }); return }

    try {
      const res = await fetch(`/api/import-sheet?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        const err = await res.json().catch(()=>({error:`HTTP ${res.status}`}))
        update(tab.key, { status:"error", msg: err.error ?? `Fetch failed: ${res.status}` })
        return
      }
      const csv = await res.text()
      const lines = csv.trim().split(/\r?\n/).filter(l=>l.trim())
      if (lines.length < 2) { update(tab.key, { status:"error", msg:"Sheet tab appears empty." }); return }

      const headers = parseCSVLine(lines[0])
      const rows    = lines.slice(1).map(parseCSVLine)
      const cm      = Object.fromEntries(Object.entries(MATCHERS).map(([f,k])=>[f,detectCol(headers,k)]))

      const parsed: Transaction[] = rows
        .filter(r => r.some(v=>v?.trim()))
        .map(row => {
          const g = (f: string) => cm[f]>=0 ? row[cm[f]]??"" : ""
          const entity = g("entity")
          const debit  = parseNum(g("debit")), credit = parseNum(g("credit"))
          return {
            type:        tab.key,
            date:        normDate(g("date")) || new Date().toISOString().slice(0,10),
            document_no: g("document_no"),
            platform:    detectPlatform(entity)||"Other",
            entity,
            description: g("description"),
            debit, credit,
            amount: parseNum(g("amount"))||Math.abs(debit-credit)||debit||credit,
            tds:    parseNum(g("tds")),
            status: g("status")||"Open",
          }
        })

      update(tab.key, {
        status:  "preview",
        msg:     `✓ ${parsed.length} rows ready — click Save to replace ${tab.label} in Supabase.`,
        count:   parsed.length,
        preview: { headers, rows: rows.slice(0,5) },
        parsed,
      })
    } catch(e:any) {
      update(tab.key, { status:"error", msg: e.message })
    }
  }

  const handleSave = async (tab: TabCfg) => {
    const { parsed } = states[tab.key]
    if (!parsed?.length) return
    update(tab.key, { status:"saving", msg:"Deleting old records…" })

    // 1. Delete all existing records for this type
    await fetch(`/api/transactions?type=${tab.key}`, { method:"DELETE" })

    // 2. Insert new
    update(tab.key, { status:"saving", msg:"Inserting new records…" })
    await onSave(parsed)

    update(tab.key, {
      status:  "done",
      msg:     `✓ ${parsed.length} rows saved for ${tab.label}`,
      preview: null,
      parsed:  null,
    })
    setTimeout(()=>update(tab.key,{status:"idle",msg:""}), 4000)
  }

  const openSheet = () => window.open(`${SHEET_BASE}/edit`, "_blank")

  const copyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT)
    setCopied(true)
    setTimeout(()=>setCopied(false), 2500)
  }

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Import from Google Sheets</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              One tab per transaction type. Import replaces existing data for that type in Supabase.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={openSheet}
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium flex items-center gap-1.5">
              🔗 Open Sheet
            </button>
            <button onClick={()=>setShowScript(s=>!s)}
              className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-medium flex items-center gap-1.5">
              ⚙️ Setup Tabs (Script)
            </button>
          </div>
        </div>

        {/* Setup instructions */}
        {showScript && (
          <div className="mt-4 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold text-amber-900 mb-1">One-time sheet setup:</div>
              <div>1. Open the sheet → <strong>Extensions → Apps Script</strong></div>
              <div>2. Paste the script below → click <strong>Run → setupPulsePanelTabs</strong></div>
              <div>3. Back in the sheet: <strong>File → Share → Publish to web → Each sheet as CSV → Publish</strong></div>
              <div>4. Copy each tab URL (click each tab → copy from address bar) → paste in the fields below</div>
            </div>
            <div className="relative">
              <pre className="bg-slate-900 text-green-300 text-[11px] rounded-xl p-4 overflow-x-auto max-h-48 font-mono leading-relaxed">
                {APPS_SCRIPT}
              </pre>
              <button onClick={copyScript}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Per-tab import rows */}
      <div className="space-y-2">
        {TABS.map(tab => {
          const s = states[tab.key]
          const borderColor = s.status==="done" ? "border-emerald-300"
                            : s.status==="error" ? "border-rose-300"
                            : s.status==="preview" ? "border-violet-300"
                            : "border-slate-200"

          return (
            <div key={tab.key} className={`bg-white rounded-xl border ${borderColor} shadow-sm p-3 transition-colors`}>
              <div className="flex items-center gap-3 flex-wrap">

                {/* Label */}
                <div className="flex items-center gap-2 w-44 shrink-0">
                  <span className="text-lg">{tab.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{tab.label}</div>
                    <div className={`text-[10px] font-medium ${tab.ar ? "text-emerald-600" : "text-rose-500"}`}>
                      {tab.ar ? "AR" : "AP"}
                    </div>
                  </div>
                </div>

                {/* URL input */}
                <input
                  type="url"
                  value={s.url}
                  onChange={e => update(tab.key, { url:e.target.value, status:"idle", msg:"" })}
                  placeholder={`Paste URL of "${tab.hint}" tab`}
                  className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-700"
                />

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {s.status === "preview" && (
                    <button
                      onClick={() => handleSave(tab)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 whitespace-nowrap"
                    >
                      {saving ? "Saving…" : `⚡ Replace ${s.count} rows`}
                    </button>
                  )}
                  <button
                    onClick={() => handleImport(tab)}
                    disabled={s.status==="fetching"||s.status==="saving"}
                    className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 disabled:opacity-50 whitespace-nowrap"
                  >
                    {s.status==="fetching" ? "Fetching…" : s.status==="saving" ? "Saving…" : "↓ Import"}
                  </button>
                </div>
              </div>

              {/* Status / message */}
              {s.msg && (
                <div className={`mt-1.5 text-xs px-1 ${
                  s.status==="error" ? "text-rose-600" :
                  s.status==="done"  ? "text-emerald-600 font-medium" :
                  s.status==="preview" ? "text-violet-700 font-medium" : "text-slate-500"
                }`}>{s.msg}</div>
              )}

              {/* Mini preview */}
              {s.preview && (
                <div className="mt-2 overflow-x-auto rounded border border-slate-100">
                  <table className="text-[11px] w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        {s.preview.headers.map((h,i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.preview.rows.map((row,ri) => (
                        <tr key={ri} className={ri%2===0?"bg-white":"bg-slate-50/50"}>
                          {row.map((cell,ci)=>(
                            <td key={ci} className="px-2 py-1 text-slate-600 whitespace-nowrap max-w-[150px] truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[10px] text-slate-400 px-2 py-1">Showing first 5 of {s.count} rows</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
