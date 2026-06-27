"use client"
import { useState, useEffect, useCallback } from "react"

// ─── SHEET URLs ───────────────────────────────────────────────────────────────
const SHEET_ARAP = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQic7FAazD2oLAIGRxBT8QGyAbM9pChIruIhS8PtdtcBhuD8c9B0k0EbFG5_duCdkNksq_dxyRF8sM3/pub?output=csv"
const SHEET_CF   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2B28C8WnJefHbWfpn3B2lLG6fDn14sjeFOGRZqQ83Be0F5WUwU5LPm1Z1S0OLpNns6P_NgaSWIRsr/pub?output=csv"

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg:          "#0B0F1A",
  surface:     "#131929",
  surfaceAlt:  "#1A2236",
  border:      "#222E45",
  accent:      "#F5A623",
  accentDim:   "#F5A62322",
  positive:    "#22C55E",
  positiveDim: "#22C55E18",
  negative:    "#EF4444",
  negativeDim: "#EF444418",
  neutral:     "#94A3B8",
  white:       "#F1F5F9",
  dimText:     "#64748B",
  blinkit:     "#F5A623",
  swiggy:      "#FF6B35",
  zepto:       "#8B5CF6",
  amazon:      "#60A5FA",
  bigbasket:   "#22C55E",
  firstclub:   "#EC4899",
}

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  return text.trim().split("\n").map(row => {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') { inQuotes = !inQuotes }
      else if (row[i] === "," && !inQuotes) { result.push(current.trim()); current = "" }
      else { current += row[i] }
    }
    result.push(current.trim())
    return result
  })
}

function parseNum(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[₹,\s]/g, "").replace(/[()]/g, m => m === "(" ? "-" : "")) || 0
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmt(n: number, compact = false): string {
  if (isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (compact) {
    if (abs >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
    if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`
    if (abs >= 1000)     return `₹${(abs / 1000).toFixed(0)}K`
    return `₹${abs.toLocaleString("en-IN")}`
  }
  return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
function pct(a: number, b: number): string { return b ? `${((a / b) * 100).toFixed(1)}%` : "—" }
function pColor(platform: string): string {
  const m: Record<string, string> = { Blinkit: C.blinkit, BLINKIT: C.blinkit, Swiggy: C.swiggy, SWIGGY: C.swiggy, Zepto: C.zepto, ZEPTO: C.zepto, Amazon: C.amazon, AMAZON: C.amazon, BigBasket: C.bigbasket, BIGBASKET: C.bigbasket, FirstClub: C.firstclub, FIRSTCLUB: C.firstclub }
  return m[platform] || C.neutral
}

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: 1, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 150 }}>
      <div style={{ color: C.dimText, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>{label}</div>
      <div style={{ color: color || C.white, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ color: C.dimText, fontSize: 11, marginTop: 4 }}>{sub}</div>}
      <div style={{ height: 2, background: C.accent, borderRadius: 2, marginTop: 12, width: 32 }} />
    </div>
  )
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? C.accent : "transparent", color: active ? "#0B0F1A" : C.neutral, border: "none", cursor: "pointer", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, transition: "all 0.15s" }}>
      {label}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ color: C.dimText, fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: "10px 12px", textAlign: "left" as const, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, background: C.surfaceAlt }}>{children}</th>
}

function BarChart({ data, height = 100 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, marginTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ width: "100%", maxWidth: 32, height: `${(Math.abs(d.value) / max) * height * 0.85}px`, background: d.value >= 0 ? C.positive : C.negative, borderRadius: "3px 3px 0 0", opacity: 0.85, minHeight: 2 }} />
          <div style={{ color: C.dimText, fontSize: 8, textAlign: "center" as const }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── DATA TYPES ──────────────────────────────────────────────────────────────
interface SheetData {
  arap: string[][]
  cf:   string[][]
}

// ─── DATA EXTRACTORS FROM SHEET ──────────────────────────────────────────────
function extractARAPSummary(rows: string[][]) {
  const lines = [
    "INVOICE", "RETURNS", "NET SALES", "PAYMENT",
    "ACCOUNTS RECEIVABLE 1", "TDS RECEIVABLE", "ACCOUNTS RECEIVABLE 2",
    "BRAND FUNDED DISCOUNT", "ACCOUNTS RECEIVABLE 3", "AR/AP ADJUSTMENTS",
    "ACCOUNTS RECEIVABLE 4",
  ]
  const apLines = [
    "INVOICE", "PAYMENT", "ACCOUNTS PAYABLE 1", "DEBIT NOTE",
    "ACCOUNTS PAYABLE 2", "TDS DEDUCTED", "ACCOUNTS PAYABLE 3",
    "AR/AP ADJUSTMENTS", "ACCOUNTS PAYABLE 4",
  ]
  const result: { label: string; ar: number | null; ap: number | null; highlight?: boolean; final?: boolean; divider?: boolean }[] = []
  const findRow = (label: string) => rows.find(r => r[0]?.trim().toUpperCase() === label.toUpperCase())

  // AR waterfall
  let apIdx = 0
  const arLabels = ["INVOICE", "RETURNS", "NET SALES", "PAYMENT", "ACCOUNTS RECEIVABLE 1", "TDS RECEIVABLE", "ACCOUNTS RECEIVABLE 2", "BRAND FUNDED DISCOUNT", "ACCOUNTS RECEIVABLE 3", "AR/AP ADJUSTMENTS", "ACCOUNTS RECEIVABLE 4"]
  const apLabels = ["INVOICE", "PAYMENT", "ACCOUNTS PAYABLE 1", "DEBIT NOTE", "ACCOUNTS PAYABLE 2", "TDS DEDUCTED", "ACCOUNTS PAYABLE 3", "AR/AP ADJUSTMENTS", "ACCOUNTS PAYABLE 4"]

  const displayLabels: Record<string, string> = {
    "ACCOUNTS RECEIVABLE 1": "AR 1", "ACCOUNTS RECEIVABLE 2": "AR 2", "ACCOUNTS RECEIVABLE 3": "AR 3",
    "ACCOUNTS RECEIVABLE 4": "AR4 (FINAL)", "ACCOUNTS PAYABLE 1": "AP 1", "ACCOUNTS PAYABLE 2": "AP 2",
    "ACCOUNTS PAYABLE 3": "AP 3", "ACCOUNTS PAYABLE 4": "AP4 (FINAL)", "TDS RECEIVABLE": "TDS Receivable",
    "TDS DEDUCTED": "TDS Deducted", "AR/AP ADJUSTMENTS": "AR/AP Adjustments", "BRAND FUNDED DISCOUNT": "Brand Funded Disc",
  }

  const arRows = arLabels.map(l => ({ label: l, row: findRow(l) }))
  const apRows = apLabels.map(l => ({ label: l, row: findRow(l) }))

  // Build combined waterfall
  const maxLen = Math.max(arRows.length, apRows.length)
  for (let i = 0; i < maxLen; i++) {
    const ar = arRows[i]
    const ap = apRows[i]
    const label = displayLabels[ar?.label || ""] || ar?.label || ap?.label || ""
    const arVal = ar?.row ? parseNum(ar.row[1]) : null
    const apVal = ap?.row ? parseNum(ap.row[1]) : null
    const isFinal = ar?.label === "ACCOUNTS RECEIVABLE 4" || ap?.label === "ACCOUNTS PAYABLE 4"
    const isHighlight = /ACCOUNTS (RECEIVABLE|PAYABLE) [1-4]/.test(ar?.label || "") || /ACCOUNTS (RECEIVABLE|PAYABLE) [1-4]/.test(ap?.label || "")
    result.push({ label, ar: arVal, ap: apVal, highlight: isHighlight, final: isFinal, divider: ar?.label === "NET SALES" })
  }
  return result
}

function extractPlatformSummary(rows: string[][]) {
  const platforms = ["SWIGGY", "BLINKIT", "ZEPTO", "AMAZON", "BigBasket", "FIRSTCLUB"]
  // Find header row to get column indices
  const headerRow = rows.find(r => r.some(c => c?.includes("SWIGGY") || c?.includes("Swiggy")))
  if (!headerRow) return []

  return platforms.map(p => {
    const colIdx = headerRow.findIndex(c => c?.toUpperCase().includes(p.toUpperCase()))
    if (colIdx === -1) return null
    const getVal = (label: string) => {
      const row = rows.find(r => r[0]?.trim().toUpperCase() === label.toUpperCase())
      return row ? parseNum(row[colIdx]) : 0
    }
    return {
      name: p === "BIGBASKET" ? "BigBasket" : p.charAt(0) + p.slice(1).toLowerCase(),
      color: pColor(p),
      invoice: getVal("INVOICE"),
      bfd: getVal("BRAND FUNDED DISCOUNT"),
      ar4: getVal("ACCOUNTS RECEIVABLE 4"),
      ap4: getVal("ACCOUNTS PAYABLE 4"),
    }
  }).filter(Boolean) as any[]
}

function extractAgingAR(rows: string[][]) {
  // Find aging section — look for "customer_name" or "Net O/s balance" header
  const agingHeader = rows.findIndex(r => r.some(c => c?.toLowerCase().includes("net o/s") || c?.toLowerCase().includes("days_1-15")))
  if (agingHeader === -1) return []
  const agingRows = rows.slice(agingHeader + 1).filter(r => r[0]?.trim() && !r[0].includes("customer_name"))
  return agingRows.slice(0, 15).map(r => ({
    customer: r[0]?.trim(),
    netOs: parseNum(r[1]),
    credits: parseNum(r[2]),
    d1_15: parseNum(r[3]),
    d16_30: parseNum(r[4]),
    d31_45: parseNum(r[5]),
    d45: parseNum(r[6]),
    platform: r[8]?.trim() || "Other",
  })).filter(r => r.customer && r.netOs !== 0)
}

function extractVendorBalances(rows: string[][]) {
  const vendorHeader = rows.findIndex(r => r.some(c => c?.toLowerCase().includes("vendor_name") || c?.toLowerCase().includes("closing_balance")))
  if (vendorHeader === -1) return []
  return rows.slice(vendorHeader + 1).filter(r => r[0]?.trim() && r[1]?.trim()).map(r => ({
    name: r[0]?.trim(),
    balance: parseNum(r[1]),
  })).filter(r => r.name && r.balance !== 0)
}

function extractCashFlow(rows: string[][]) {
  // Find monthly net cash outflow row
  const netFlowRow = rows.find(r => r[0]?.toLowerCase().includes("monthly net cash"))
  const months = ["Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26"]

  // Find platform receipts rows
  const platforms = ["BLINKIT", "SWIGGY", "ZEPTO", "BIGBASKET", "D2C", "FIRSTCLUB"]
  const cashIn: Record<string, number[]> = {}
  platforms.forEach(p => {
    const row = rows.find(r => r[0]?.toUpperCase().trim() === p)
    if (row) cashIn[p] = row.slice(2, 14).map(parseNum)
  })

  // Find expense rows
  const expenseLabels = ["Salary Payable", "AMIT VEGETABLES", "NAVEEN GENERAL STORE", "FOODPRO PACKAGING PRIVATE LIMITED", "MOVIN EXPRESS PRIVATE LIMITED", "TURTLE MEDIA PRIVATE LIMITED", "Ads Nischal Naidu Kandula Reimbursement"]
  const cashOut: Record<string, number[]> = {}
  expenseLabels.forEach(label => {
    const row = rows.find(r => r[0]?.trim() === label)
    if (row) cashOut[label.replace(" PRIVATE LIMITED", "").replace("Ads Nischal Naidu Kandula Reimbursement", "Ads (Reimbursement)")] = row.slice(2, 14).map(v => Math.abs(parseNum(v)) * -1)
  })

  const netFlow = netFlowRow ? netFlowRow.slice(3, 15).map(parseNum) : []

  return { months, cashIn, cashOut, netFlow }
}

// ─── TABS ────────────────────────────────────────────────────────────────────

function ARAPTab({ data }: { data: string[][] }) {
  const [view, setView] = useState<"waterfall" | "platforms" | "aging">("waterfall")
  const summary  = extractARAPSummary(data)
  const platforms = extractPlatformSummary(data)
  const aging    = extractAgingAR(data)

  const ar4row = summary.find(r => r.label === "AR4 (FINAL)")
  const ap4row = summary.find(r => r.label === "AP4 (FINAL)")
  const ar4 = ar4row?.ar || 0
  const ap4 = ap4row?.ap || 0
  const net = ar4 + ap4
  const bfdRow = summary.find(r => r.label === "Brand Funded Disc")

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="AR4 — Total Receivable" value={fmt(ar4, true)} sub="After BFD & adjustments" color={C.positive} />
        <KpiCard label="AP4 — Total Payable" value={fmt(Math.abs(ap4), true)} sub="Platform fees & charges" color={C.negative} />
        <KpiCard label="Net Position" value={fmt(net, true)} sub="AR4 minus AP4" color={net >= 0 ? C.positive : C.negative} />
        <KpiCard label="Brand Funded Disc" value={fmt(Math.abs(bfdRow?.ar || 0), true)} sub="Total BFD setoff" color={C.accent} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.surfaceAlt, padding: 4, borderRadius: 10, width: "fit-content" }}>
        {(["waterfall", "platforms", "aging"] as const).map(v => (
          <Tab key={v} label={v === "waterfall" ? "Waterfall" : v === "platforms" ? "By Platform" : "AR + AP Aging"} active={view === v} onClick={() => setView(v)} />
        ))}
      </div>

      {view === "waterfall" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", borderBottom: `1px solid ${C.border}`, padding: "10px 16px", background: C.surfaceAlt }}>
            {["LINE ITEM", "ACCOUNTS RECEIVABLE", "ACCOUNTS PAYABLE"].map(h => (
              <div key={h} style={{ color: C.dimText, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{h}</div>
            ))}
          </div>
          {summary.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", padding: "10px 16px", background: row.final ? C.accentDim : row.highlight ? C.surfaceAlt : "transparent", borderBottom: `1px solid ${C.border}`, borderTop: row.divider ? `1px solid ${C.accent}44` : "none" }}>
              <div style={{ color: row.final ? C.accent : row.highlight ? C.white : C.neutral, fontSize: 12, fontWeight: row.final || row.highlight ? 700 : 400 }}>{row.label}</div>
              <div style={{ color: row.ar === null ? C.dimText : (row.ar ?? 0) >= 0 ? C.positive : C.negative, fontSize: 12, fontWeight: row.final ? 700 : 500 }}>
                {row.ar === null ? "—" : fmt(row.ar ?? 0)}
              </div>
              <div style={{ color: row.ap === null ? C.dimText : (row.ap ?? 0) >= 0 ? C.positive : C.negative, fontSize: 12, fontWeight: row.final ? 700 : 500 }}>
                {row.ap === null ? "—" : fmt(row.ap ?? 0)}
              </div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", padding: "12px 16px", background: C.accentDim }}>
            <div style={{ color: C.accent, fontSize: 12, fontWeight: 800 }}>NET CASH INFLOW</div>
            <div style={{ color: net >= 0 ? C.positive : C.negative, fontSize: 12, fontWeight: 800 }}>{fmt(net)}</div>
            <div style={{ color: C.dimText, fontSize: 11 }}>AR4 − |AP4|</div>
          </div>
        </div>
      )}

      {view === "platforms" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {platforms.map((p: any, i: number) => {
            const net = p.ar4 + p.ap4
            return (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, borderLeft: `3px solid ${p.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: p.color, fontWeight: 800, fontSize: 15 }}>{p.name}</div>
                  <Badge color={net >= 0 ? C.positive : C.negative}>{net >= 0 ? "NET +VE" : "NET −VE"}</Badge>
                </div>
                {[
                  { label: "Invoice", val: p.invoice, color: C.neutral },
                  { label: "BFD Setoff", val: p.bfd, color: C.accent },
                  { label: "AR4", val: p.ar4, color: C.positive },
                  { label: "AP4", val: p.ap4, color: C.negative },
                ].map((r, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: C.dimText, fontSize: 11 }}>{r.label}</span>
                    <span style={{ color: r.color, fontSize: 12, fontWeight: 600 }}>{fmt(r.val, true)}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.dimText, fontSize: 11, fontWeight: 700 }}>NET</span>
                  <span style={{ color: net >= 0 ? C.positive : C.negative, fontSize: 13, fontWeight: 800 }}>{fmt(net, true)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === "aging" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* AR Aging */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.positive }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>AR Aging — Customer Receivables</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11 }}>
                <thead><tr>{["Customer", "Platform", "Net O/S", "Credits", "1-15 Days", "16-30 Days", "31-45 Days", "45+ Days"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {aging.map((r, i) => {
                    const d45pct = r.netOs > 0 ? r.d45 / r.netOs : 0
                    const pc = pColor(r.platform)
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: d45pct > 0.6 ? C.negativeDim : "transparent" }}>
                        <td style={{ padding: "9px 12px", color: C.white, fontWeight: 600, whiteSpace: "nowrap" as const }}>{r.customer}</td>
                        <td style={{ padding: "9px 12px" }}><Badge color={pc}>{r.platform}</Badge></td>
                        <td style={{ padding: "9px 12px", color: C.white, fontWeight: 700 }}>{fmt(r.netOs, true)}</td>
                        <td style={{ padding: "9px 12px", color: C.negative }}>{r.credits < 0 ? fmt(r.credits, true) : "—"}</td>
                        <td style={{ padding: "9px 12px", color: C.positive }}>{r.d1_15 > 0 ? fmt(r.d1_15, true) : "—"}</td>
                        <td style={{ padding: "9px 12px", color: C.accent }}>{r.d16_30 > 0 ? fmt(r.d16_30, true) : "—"}</td>
                        <td style={{ padding: "9px 12px", color: "#FB923C" }}>{r.d31_45 > 0 ? fmt(r.d31_45, true) : "—"}</td>
                        <td style={{ padding: "9px 12px", color: d45pct > 0.6 ? C.negative : C.neutral, fontWeight: d45pct > 0.6 ? 700 : 400 }}>
                          {fmt(r.d45, true)}{d45pct > 0.6 ? " ⚠" : ""}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: C.surfaceAlt }}>
                    <td colSpan={2} style={{ padding: "10px 12px", color: C.accent, fontWeight: 800 }}>TOTAL</td>
                    <td style={{ padding: "10px 12px", color: C.positive, fontWeight: 800 }}>{fmt(aging.reduce((s, r) => s + r.netOs, 0), true)}</td>
                    <td style={{ padding: "10px 12px", color: C.negative, fontWeight: 700 }}>{fmt(aging.reduce((s, r) => s + r.credits, 0), true)}</td>
                    <td style={{ padding: "10px 12px", color: C.positive, fontWeight: 700 }}>{fmt(aging.reduce((s, r) => s + r.d1_15, 0), true)}</td>
                    <td style={{ padding: "10px 12px", color: C.accent, fontWeight: 700 }}>{fmt(aging.reduce((s, r) => s + r.d16_30, 0), true)}</td>
                    <td style={{ padding: "10px 12px", color: "#FB923C", fontWeight: 700 }}>{fmt(aging.reduce((s, r) => s + r.d31_45, 0), true)}</td>
                    <td style={{ padding: "10px 12px", color: C.negative, fontWeight: 700 }}>{fmt(aging.reduce((s, r) => s + r.d45, 0), true)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* AP Aging — Vendor Balances */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.negative }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>AP Aging — Vendor Payables</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11 }}>
                <thead><tr>{["Vendor", "Balance", "Type"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {extractVendorBalances(data).map((v, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", color: C.white, fontWeight: 600 }}>{v.name}</td>
                      <td style={{ padding: "9px 12px", color: v.balance > 0 ? C.negative : C.positive, fontWeight: 700 }}>{fmt(Math.abs(v.balance), true)}</td>
                      <td style={{ padding: "9px 12px" }}><Badge color={v.balance > 0 ? C.negative : C.positive}>{v.balance > 0 ? "Payable" : "Receivable"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: "8px 12px", background: C.surfaceAlt, borderRadius: 8 }}>
            <span style={{ color: C.dimText, fontSize: 10 }}>⚠ Red rows in AR = 45+ days &gt; 60% of balance — chase priority</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PL TAB (from PDF data — static but clearly labelled) ────────────────────
function PLTab() {
  const [view, setView] = useState<"annual" | "opex">("annual")
  const fy25 = { sales: 61491809, discounts: -22489807, netSales: 39340481, cogs: 23244740, grossProfit: 16095741, opex: 43117089, ebitda: -27021347 }
  const fy26 = { sales: 100708456, discounts: -36667471, netSales: 64297013, cogs: 31743426, grossProfit: 32553587, opex: 73911815, ebitda: -41358228 }
  const opex = [
    { label: "Salaries", fy25: 8186785, fy26: 14683082 },
    { label: "Advertising & Mktg", fy25: 21134694, fy26: 32986533 },
    { label: "Outbound Logistics", fy25: 3178502, fy26: 5396965 },
    { label: "Rent", fy25: 1316500, fy26: 1899500 },
    { label: "Civil & Maintenance", fy25: 0, fy26: 3702623 },
    { label: "Legal & Professional", fy25: 3360527, fy26: 154970 },
    { label: "Staff Welfare", fy25: 204359, fy26: 1194407 },
    { label: "Technology", fy25: 120472, fy26: 324514 },
  ]

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="FY26 Gross Sales" value={fmt(fy26.sales, true)} sub={`↑ from ${fmt(fy25.sales, true)} FY25`} color={C.positive} />
        <KpiCard label="Gross Margin FY26" value={pct(fy26.grossProfit, fy26.netSales)} sub={`${pct(fy25.grossProfit, fy25.netSales)} in FY25`} color={C.accent} />
        <KpiCard label="EBITDA FY26" value={fmt(fy26.ebitda, true)} sub="Operating loss" color={C.negative} />
        <KpiCard label="Gross Profit FY26" value={fmt(fy26.grossProfit, true)} sub={`↑ 2x from ${fmt(fy25.grossProfit, true)}`} color={C.positive} />
      </div>
      <div style={{ padding: "8px 12px", background: C.accentDim, borderRadius: 8, marginBottom: 16, display: "flex", gap: 8 }}>
        <span style={{ color: C.accent }}>ℹ</span>
        <span style={{ color: C.neutral, fontSize: 11 }}>P&L data from Zoho Books provisional report (FY25 & FY26) — update sheet when new export available</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.surfaceAlt, padding: 4, borderRadius: 10, width: "fit-content" }}>
        <Tab label="Annual Compare" active={view === "annual"} onClick={() => setView("annual")} />
        <Tab label="OpEx Breakdown" active={view === "opex"} onClick={() => setView("opex")} />
      </div>
      {view === "annual" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {[["FY 2024-25", fy25], ["FY 2025-26", fy26]].map(([label, d]: any, idx) => (
            <div key={idx} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, borderTop: `3px solid ${idx === 1 ? C.accent : C.border}` }}>
              <div style={{ color: idx === 1 ? C.accent : C.neutral, fontWeight: 800, fontSize: 14, marginBottom: 16 }}>{label as string}</div>
              {[
                { label: "Gross Sales", val: d.sales, color: C.white, bold: true },
                { label: "Discounts & Trade", val: d.discounts, color: C.negative },
                { label: "Net Revenue", val: d.netSales, color: C.white, bold: true },
                { label: "Cost of Goods Sold", val: -d.cogs, color: C.negative },
                { label: "Gross Profit", val: d.grossProfit, color: C.positive, bold: true },
                { label: "Gross Margin %", val: pct(d.grossProfit, d.netSales), color: C.accent, isStr: true },
                { label: "Operating Expenses", val: -d.opex, color: C.negative },
                { label: "EBITDA", val: d.ebitda, color: d.ebitda >= 0 ? C.positive : C.negative, bold: true },
              ].map((r: any, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <span style={{ color: r.bold ? C.white : C.dimText, fontSize: 12, fontWeight: r.bold ? 600 : 400 }}>{r.label}</span>
                  <span style={{ color: r.color, fontSize: 12, fontWeight: r.bold ? 700 : 500 }}>
                    {r.isStr ? r.val : r.val < 0 ? `(${fmt(-r.val, true)})` : fmt(r.val, true)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {view === "opex" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: C.white, fontWeight: 700, marginBottom: 16 }}>OpEx Breakdown — FY25 vs FY26</div>
          {opex.sort((a, b) => b.fy26 - a.fy26).map((r, i) => {
            const maxVal = Math.max(...opex.map(x => x.fy26))
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: C.neutral, fontSize: 12 }}>{r.label}</span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ color: C.dimText, fontSize: 11 }}>FY25: {fmt(r.fy25, true)}</span>
                    <span style={{ color: C.white, fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: "right" as const }}>FY26: {fmt(r.fy26, true)}</span>
                  </div>
                </div>
                <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", height: "100%" }}>
                    <div style={{ width: `${(r.fy25 / maxVal) * 100}%`, background: C.dimText, opacity: 0.5 }} />
                    <div style={{ width: `${Math.max(0, (r.fy26 - r.fy25) / maxVal) * 100}%`, background: r.label.includes("Mktg") || r.label.includes("Adv") ? C.accent : C.negative }} />
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 16, padding: 12, background: C.accentDim, borderRadius: 8 }}>
            <span style={{ color: C.neutral, fontSize: 11 }}>⚡ Advertising & Marketing is the largest OpEx at ₹3.3Cr (FY26) — 44% of total operating expenses</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CF TAB ──────────────────────────────────────────────────────────────────
function CFTab({ data }: { data: string[][] }) {
  const [view, setView] = useState<"monthly" | "vendors">("monthly")
  const { months, cashIn, cashOut, netFlow } = extractCashFlow(data)

  const totalIn  = months.map((_, i) => Object.values(cashIn).reduce((s, arr) => s + (arr[i] || 0), 0))
  const totalOut = months.map((_, i) => Object.values(cashOut).reduce((s, arr) => s + (arr[i] || 0), 0))

  const vendors = extractVendorBalances(data)
  const payables    = vendors.filter(v => v.balance > 0)
  const receivables = vendors.filter(v => v.balance < 0)

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="Avg Monthly Cash In" value={fmt(totalIn.length ? totalIn.reduce((a, b) => a + b, 0) / totalIn.length : 0, true)} sub="Platform receipts avg" color={C.positive} />
        <KpiCard label="Avg Monthly Cash Out" value={fmt(totalOut.length ? Math.abs(totalOut.reduce((a, b) => a + b, 0) / totalOut.length) : 0, true)} sub="All expenses avg" color={C.negative} />
        <KpiCard label="Total Vendor Payables" value={fmt(payables.reduce((s, v) => s + v.balance, 0), true)} sub="Outstanding to vendors" color={C.negative} />
        <KpiCard label="Vendor Receivables" value={fmt(Math.abs(receivables.reduce((s, v) => s + v.balance, 0)), true)} sub="Vendors owe you" color={C.positive} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.surfaceAlt, padding: 4, borderRadius: 10, width: "fit-content" }}>
        <Tab label="Monthly Flow" active={view === "monthly"} onClick={() => setView("monthly")} />
        <Tab label="Vendor Balances" active={view === "vendors"} onClick={() => setView("vendors")} />
      </div>

      {view === "monthly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Net flow chart */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ color: C.white, fontWeight: 700, marginBottom: 4 }}>Monthly Net Cash Flow</div>
            <div style={{ color: C.dimText, fontSize: 11, marginBottom: 12 }}>Surplus vs Deficit each month</div>
            {netFlow.length > 0 && <BarChart data={netFlow.map((v, i) => ({ label: (months[i] || "").substring(0, 3), value: v }))} height={130} />}
          </div>

          {/* Cash IN */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.positive }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>Cash IN — Platform Receipts</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: C.surfaceAlt }}>
                    <th style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 12px", textAlign: "left" as const, letterSpacing: 1, minWidth: 110 }}>PLATFORM</th>
                    {months.map(m => <th key={m} style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 10px", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>{m}</th>)}
                    <th style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 10px", textAlign: "right" as const }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cashIn).map(([platform, vals], i) => {
                    const pc = pColor(platform)
                    const total = vals.reduce((a, b) => a + b, 0)
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "8px 12px" }}><Badge color={pc}>{platform}</Badge></td>
                        {vals.map((v, j) => <td key={j} style={{ padding: "8px 10px", color: v > 0 ? C.positive : C.dimText, textAlign: "right" as const }}>{v > 0 ? fmt(v, true) : "—"}</td>)}
                        <td style={{ padding: "8px 10px", color: C.positive, fontWeight: 700, textAlign: "right" as const }}>{fmt(total, true)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: C.positiveDim }}>
                    <td style={{ padding: "9px 12px", color: C.positive, fontWeight: 800 }}>TOTAL IN</td>
                    {totalIn.map((v, j) => <td key={j} style={{ padding: "9px 10px", color: C.positive, fontWeight: 700, textAlign: "right" as const }}>{fmt(v, true)}</td>)}
                    <td style={{ padding: "9px 10px", color: C.positive, fontWeight: 800, textAlign: "right" as const }}>{fmt(totalIn.reduce((a, b) => a + b, 0), true)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash OUT */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.negative }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>Cash OUT — Expense Categories</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: C.surfaceAlt }}>
                    <th style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 12px", textAlign: "left" as const, minWidth: 160 }}>CATEGORY</th>
                    {months.map(m => <th key={m} style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 10px", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>{m}</th>)}
                    <th style={{ color: C.dimText, fontWeight: 700, fontSize: 9, padding: "8px 10px", textAlign: "right" as const }}>AVG/MTH</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cashOut).map(([cat, vals], i) => {
                    const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "8px 12px", color: C.neutral, fontSize: 11 }}>{cat}</td>
                        {vals.map((v, j) => <td key={j} style={{ padding: "8px 10px", color: v < 0 ? C.negative : C.dimText, textAlign: "right" as const }}>{v < 0 ? fmt(-v, true) : "—"}</td>)}
                        <td style={{ padding: "8px 10px", color: C.negative, fontWeight: 600, textAlign: "right" as const }}>{avg < 0 ? fmt(-avg, true) : "—"}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: C.negativeDim }}>
                    <td style={{ padding: "9px 12px", color: C.negative, fontWeight: 800 }}>TOTAL OUT</td>
                    {totalOut.map((v, j) => <td key={j} style={{ padding: "9px 10px", color: C.negative, fontWeight: 700, textAlign: "right" as const }}>{fmt(-v, true)}</td>)}
                    <td style={{ padding: "9px 10px", color: C.negative, fontWeight: 800, textAlign: "right" as const }}>{fmt(-totalOut.reduce((a, b) => a + b, 0) / (totalOut.length || 1), true)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net row */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11, minWidth: 900 }}>
                <tbody>
                  <tr style={{ background: C.surfaceAlt }}>
                    <td style={{ padding: "10px 12px", color: C.accent, fontWeight: 800, fontSize: 12, minWidth: 160 }}>NET CASH FLOW</td>
                    {netFlow.map((v, j) => (
                      <td key={j} style={{ padding: "10px 10px", color: v >= 0 ? C.positive : C.negative, fontWeight: 800, textAlign: "right" as const, whiteSpace: "nowrap" as const }}>
                        {v >= 0 ? "+" : ""}{fmt(v, true)}
                      </td>
                    ))}
                    <td />
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 12px", color: C.dimText, fontSize: 11 }}>Status</td>
                    {netFlow.map((v, j) => (
                      <td key={j} style={{ padding: "8px 10px", textAlign: "right" as const }}>
                        <Badge color={v >= 0 ? C.positive : v > -1000000 ? C.accent : C.negative}>
                          {v >= 0 ? "+" : v > -1000000 ? "~" : "−"}
                        </Badge>
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "vendors" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ color: C.white, fontWeight: 700, marginBottom: 16 }}>Vendor Payables</div>
            {payables.map((v, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.neutral, fontSize: 12 }}>{v.name}</span>
                <span style={{ color: C.negative, fontWeight: 700, fontSize: 12 }}>{fmt(v.balance, true)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span style={{ color: C.accent, fontSize: 12 }}>TOTAL</span>
              <span style={{ color: C.negative, fontSize: 13 }}>{fmt(payables.reduce((s, v) => s + v.balance, 0), true)}</span>
            </div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ color: C.white, fontWeight: 700, marginBottom: 16 }}>Vendor Receivables (Credit Balance)</div>
            {receivables.map((v, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.neutral, fontSize: 12 }}>{v.name}</span>
                <span style={{ color: C.positive, fontWeight: 700, fontSize: 12 }}>{fmt(Math.abs(v.balance), true)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: 10, background: C.positiveDim, borderRadius: 8 }}>
              <span style={{ color: C.positive, fontSize: 11 }}>These vendors owe you money — follow up</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab]       = useState<"arap" | "pl" | "cf">("arap")
  const [sheet, setSheet]   = useState<SheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchSheets = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [r1, r2] = await Promise.all([
        fetch(SHEET_ARAP + "&t=" + Date.now()),
        fetch(SHEET_CF   + "&t=" + Date.now()),
      ])
      if (!r1.ok || !r2.ok) throw new Error("Sheet fetch failed")
      const [t1, t2] = await Promise.all([r1.text(), r2.text()])
      setSheet({ arap: parseCSV(t1), cf: parseCSV(t2) })
      setLastRefresh(new Date())
    } catch (e: any) {
      setError("Could not load sheet data. Check publish settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSheets() }, [fetchSheets])

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", color: C.white }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🍛</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>CURRYiT Finance</div>
              <div style={{ color: C.dimText, fontSize: 10, letterSpacing: 1 }}>
                HOMECHEF INDIA VENTURES ·{" "}
                {loading ? "Loading..." : lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "—"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={fetchSheets} disabled={loading} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: loading ? C.dimText : C.accent, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
              {loading ? "⟳ Syncing..." : "⟳ Refresh"}
            </button>
            <div style={{ display: "flex", gap: 6, background: C.surfaceAlt, padding: 4, borderRadius: 10 }}>
              <Tab label="AR / AP" active={tab === "arap"} onClick={() => setTab("arap")} />
              <Tab label="P & L"   active={tab === "pl"}   onClick={() => setTab("pl")} />
              <Tab label="Cash Flow" active={tab === "cf"} onClick={() => setTab("cf")} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>
        {error && (
          <div style={{ background: C.negativeDim, border: `1px solid ${C.negative}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: C.negative, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}
        {loading && !sheet && (
          <div style={{ textAlign: "center", padding: 60, color: C.dimText }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
            <div>Fetching live data from Google Sheets...</div>
          </div>
        )}
        {sheet && (
          <>
            {tab === "arap" && <ARAPTab data={sheet.arap} />}
            {tab === "pl"   && <PLTab />}
            {tab === "cf"   && <CFTab data={sheet.cf} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 20px", textAlign: "center" as const }}>
        <span style={{ color: C.dimText, fontSize: 10, letterSpacing: 1 }}>
          LIVE DATA FROM GOOGLE SHEETS · AUTO-REFRESH ON LOAD · MANUAL REFRESH AVAILABLE
        </span>
      </div>
    </div>
  )
}
