"use client"
import { useEffect, useState } from "react"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts"

// ── Design tokens ────────────────────────────────────────────────
const C = {
  bg: "#F5F7FA", surface: "#FFFFFF", border: "#E9ECF2",
  navy: "#0F1B2E", accent: "#FF5A1F",
  green: "#16A34A", greenDim: "#16A34A15",
  red: "#DC2626", redDim: "#FDEDEC",
  amber: "#D97706", amberDim: "#FDF3E7",
  blue: "#2563EB", blueDim: "#EAF1FE",
  text: "#0F172A", dim: "#8A94A6",
}
const DONUT_COLORS = ["#22B14C", "#F5C400", "#F5A623", "#F97316", "#DC2626"]
const AVATAR_COLORS = ["#FFC107", "#FF7A00", "#8B5CF6", "#22C55E", "#2563EB", "#EC4899", "#14B8A6", "#F97316"]

interface DashboardData {
  kpis: {
    totalPayables: number; totalReceivables: number
    payablesOverdue: number; receivablesOverdue: number
    payablesOverduePct: number; receivablesOverduePct: number
    expensesThisMonth: number; expensesMomPct: number
    cashAndBankBalance: number
  }
  payablesAgeing: { label: string; amount: number }[]
  receivablesAgeing: { label: string; amount: number }[]
  expenseByCategory: { label: string; amount: number }[]
  payablesByVendor: { top: { name: string; total: number; overdue: number; pct: number }[]; rest: any[] }
  receivablesByCustomer: { top: { name: string; total: number; overdue: number; pct: number }[]; rest: any[] }
  overdueTop: { doc_no: string; party: string; due_date: string; overdue: number; side: "payable" | "receivable" }[]
  trend: { month: string; payables: number; receivables: number; expenses: number }[]
  summary: { avgPaymentDays: number; avgCollectionDays: number; openInvoices: number; overdueCount: number }
  asOf: string
}

function fmt(v: number): string {
  if (isNaN(v) || !isFinite(v)) return "—"
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
function fmtFull(v: number): string {
  return `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
function pct(v: number) { return `${v.toFixed(1)}%` }

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function EntityAvatar({ name }: { name: string }) {
  const color = avatarColor(name)
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 6, background: color + "22", border: `1px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color,
      flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function OverduePill({ value }: { value: number }) {
  const color = value >= 35 ? C.red : value >= 15 ? C.amber : C.dim
  const bg    = value >= 35 ? C.redDim : value >= 15 ? C.amberDim : "#F1F3F7"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color, fontWeight: 700, fontSize: 11, padding: "3px 9px", borderRadius: 20 }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
      {pct(value)}
    </span>
  )
}

const NAV = [
  { key: "overview",    label: "Overview",         icon: "🏠" },
  { key: "payables",    label: "Payables",         icon: "📑" },
  { key: "receivables", label: "Receivables",      icon: "💳" },
  { key: "expenses",    label: "Expenses",         icon: "🧾" },
  { key: "platforms",   label: "Platforms",        icon: "🏬" },
  { key: "reports",     label: "Reports",          icon: "📊" },
  { key: "ageing",      label: "Ageing Analysis",  icon: "📈" },
  { key: "cashflow",    label: "Cash Flow",        icon: "💵" },
  { key: "alerts",      label: "Alerts",           icon: "🔔" },
]

function KpiCard({ icon, iconBg, label, value, sub, subValue, subColor, link }:
  { icon: string; iconBg: string; label: string; value: string; sub: string; subValue?: string; subColor?: string; link: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", flex: 1, minWidth: 230, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const }}>{label}</div>
      </div>
      <div style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>
        {sub}{subValue && <span style={{ color: subColor || C.dim, fontWeight: 700 }}> {subValue}</span>}
      </div>
      <a href={link === "payables" || link === "receivables" ? "/dashboard/entities" : `#${link}`} style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
        {link === "cashflow" ? "View cash flow" : `View ${link}`} <span>→</span>
      </a>
    </div>
  )
}

function DonutCard({ title, data, total, linkId }: { title: string; data: { label: string; amount: number }[]; total: number; linkId: string }) {
  const chartData = data.filter(d => d.amount > 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 300, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }} id={linkId}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="amount" nameKey="label" innerRadius={45} outerRadius={70} paddingAngle={1} strokeWidth={0}>
                {chartData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtFull(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{fmt(total)}</div>
            <div style={{ fontSize: 9, color: C.dim, textAlign: "center" }}>Total</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11, flex: 1 }}>
          {chartData.map((d, i) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: C.dim }}>{d.label}</span>
              </div>
              <span style={{ fontWeight: 600, whiteSpace: "nowrap" as const }}>{fmt(d.amount)} <span style={{ color: C.dim }}>({total ? ((d.amount / total) * 100).toFixed(1) : 0}%)</span></span>
            </div>
          ))}
        </div>
      </div>
      <a href="/dashboard/entities" style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}>View details <span>→</span></a>
    </div>
  )
}

function TopEntityTable({ title, rows, entityLabel, linkId }:
  { title: string; rows: { name: string; total: number; overdue: number; pct: number }[]; entityLabel: string; linkId: string }) {
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandOverdue = rows.reduce((s, r) => s + r.overdue, 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 360, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }} id={linkId}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <a href="/dashboard/entities" style={{ fontSize: 11, color: C.blue, fontWeight: 600, textDecoration: "none" }}>View all →</a>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "4px 8px 8px", fontWeight: 600, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>{entityLabel}</th>
            <th style={{ padding: "4px 8px 8px", fontWeight: 600, textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Total (₹)</th>
            <th style={{ padding: "4px 8px 8px", fontWeight: 600, textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Overdue (₹)</th>
            <th style={{ padding: "4px 8px 8px", fontWeight: 600, textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>% Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No data yet</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <EntityAvatar name={r.name} />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </div>
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const }}><OverduePill value={r.pct} /></td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
              <td style={{ padding: "10px 8px" }}>Total</td>
              <td style={{ padding: "10px 8px", textAlign: "right" as const }}>{fmtFull(grandTotal)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" as const, color: C.red }}>{fmtFull(grandOverdue)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" as const }}><OverduePill value={grandTotal ? (grandOverdue / grandTotal) * 100 : 0} /></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function OverdueInvoicesCard({ rows }: { rows: DashboardData["overdueTop"] }) {
  const [tab, setTab] = useState<"payable" | "receivable">("payable")
  const filtered = rows.filter(r => r.side === tab)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 360, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Top Overdue Invoices</div>
        <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 8 }}>
          <button onClick={() => setTab("payable")} style={{ background: tab === "payable" ? C.surface : "transparent", boxShadow: tab === "payable" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11, color: tab === "payable" ? C.red : C.dim }}>Payables</button>
          <button onClick={() => setTab("receivable")} style={{ background: tab === "receivable" ? C.surface : "transparent", boxShadow: tab === "receivable" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11, color: tab === "receivable" ? C.blue : C.dim }}>Receivables</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Doc No.</th>
            <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Vendor / Customer</th>
            <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Due Date</th>
            <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Overdue (₹)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No overdue {tab === "payable" ? "bills" : "invoices"}</td></tr>
          )}
          {filtered.map(r => (
            <tr key={r.doc_no} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 8px", fontFamily: "monospace", fontSize: 11 }}>{r.doc_no}</td>
              <td style={{ padding: "9px 8px" }}>{r.party}</td>
              <td style={{ padding: "9px 8px", color: C.dim }}>{new Date(r.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const, color: C.red, fontWeight: 700 }}>{fmtFull(r.overdue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 0 && (
        <a href="/dashboard/entities" style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}>View all <span>→</span></a>
      )}
    </div>
  )
}

function TrendChart({ trend }: { trend: DashboardData["trend"] }) {
  const data = trend.map(t => ({
    month: new Date(t.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Payables: t.payables, Receivables: t.receivables,
  }))
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 360, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Payables vs Receivables Trend</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke={C.border} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} />
          <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={(v: number) => fmtFull(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Payables" stroke={C.red} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="Receivables" stroke={C.green} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExpenseTrendChart({ trend }: { trend: DashboardData["trend"] }) {
  const data = trend.map(t => ({
    month: new Date(t.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Expenses: t.expenses,
  }))
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 360, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Expense Trend (Last 6 Months)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke={C.border} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} />
          <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={(v: number) => fmtFull(v)} />
          <Bar dataKey="Expenses" fill="#2DBE8F" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SummaryCard({ summary }: { summary: DashboardData["summary"] }) {
  const rows = [
    { icon: "⏱️", label: "Average Payment Days (Payables)", value: `${summary.avgPaymentDays} Days`, color: C.red },
    { icon: "✅", label: "Average Collection Days (Receivables)", value: `${summary.avgCollectionDays} Days`, color: C.green },
    { icon: "📄", label: "Total Open Invoices", value: String(summary.openInvoices), color: C.text },
    { icon: "⚠️", label: "Invoices Overdue", value: String(summary.overdueCount), color: C.amber },
  ]
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 280, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Summary</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.dim }}>
              <span>{r.icon}</span>{r.label}
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ZohoDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/zoho/dashboard", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const MODULES = ["invoices", "bills", "creditnotes", "vendorcredits", "customerpayments", "vendorpayments", "journals", "expenses", "bankaccounts"]

  // Syncs one module at a time (instead of one long request) so a slow
  // module never times out the whole sync — and if the response ever isn't
  // JSON (a platform error page, etc.) we don't crash trying to parse it.
  const syncNow = async () => {
    setSyncing(true); setSyncMsg("")
    let failed = 0
    for (let i = 0; i < MODULES.length; i++) {
      const m = MODULES[i]
      setSyncMsg(`Syncing ${m}… (${i + 1}/${MODULES.length})`)
      try {
        const res = await fetch(`/api/zoho/sync?module=${m}`, { method: "POST" })
        const text = await res.text()
        let d: any
        try { d = JSON.parse(text) } catch { d = { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 120)}` } }
        if (d.error) failed++
      } catch {
        failed++
      }
    }
    setSyncMsg(failed ? `⚠ Synced with ${failed} module(s) failing — see below` : "✓ Synced from Zoho Books")
    load()
    setSyncing(false)
    setTimeout(() => setSyncMsg(""), 6000)
  }

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      {/* Sidebar */}
      <aside style={{ width: 224, background: C.navy, color: "#fff", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 26, padding: "0 6px" }}>
          <div style={{ width: 30, height: 30, background: C.accent, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>C</div>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>CURRYIT</div>
        </div>
        {NAV.map(n => (
          <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: n.key === "overview" ? 700 : 500, background: n.key === "overview" ? "rgba(255,255,255,0.10)" : "transparent", color: n.key === "overview" ? "#fff" : "rgba(255,255,255,0.62)", cursor: "pointer" }}>
            <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
          </div>
        ))}
        <a href="/dashboard/entities" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.62)", textDecoration: "none" }}>
          <span style={{ fontSize: 15 }}>🗂️</span>Entity Master
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.62)" }}>
          <span style={{ fontSize: 15 }}>⚙️</span>Settings
        </div>
        <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 13, fontSize: 11, color: "rgba(255,255,255,0.6)", display: "flex", gap: 9, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>🗄️</span>
          <div>Data Source<br /><b style={{ color: "#fff" }}>Zoho Books</b></div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Finance Dashboard</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>Snapshot of Payables, Receivables &amp; Expenses — synced from Zoho Books</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: C.text, fontWeight: 500 }}>
                <span>📅</span>As on {today}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: C.text, fontWeight: 600, cursor: "pointer" }}>
                <span>⚗️</span>Filters
              </div>
              <button onClick={syncNow} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.accent, color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.6 : 1 }}>
                <span>{syncing ? "⟳" : "↻"}</span>{syncing ? "Syncing…" : "Sync Zoho"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.dim, textAlign: "right" as const }}>
              {syncMsg ? <span style={{ color: syncMsg.startsWith("⚠") ? C.red : C.green, fontWeight: 600 }}>{syncMsg}</span> :
                data && <>Data as of: {new Date(data.asOf).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · auto-syncs daily</>}
            </div>
          </div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>⟳ Loading live data from Zoho Books…</div>}
        {error && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* KPI row */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <KpiCard icon="💰" iconBg={C.greenDim} label="Total Payables" value={fmt(data.kpis.totalPayables)}
                sub="Overdue:" subValue={`${fmtFull(data.kpis.payablesOverdue)} (${pct(data.kpis.payablesOverduePct)})`} subColor={C.red} link="payables" />
              <KpiCard icon="👛" iconBg={C.greenDim} label="Total Receivables" value={fmt(data.kpis.totalReceivables)}
                sub="Overdue:" subValue={`${fmtFull(data.kpis.receivablesOverdue)} (${pct(data.kpis.receivablesOverduePct)})`} subColor={C.red} link="receivables" />
              <KpiCard icon="📄" iconBg={C.blueDim} label="Total Expenses (MTD)" value={fmt(data.kpis.expensesThisMonth)}
                sub="vs Last Month:" subValue={`${data.kpis.expensesMomPct >= 0 ? "↑" : "↓"} ${pct(Math.abs(data.kpis.expensesMomPct))}`}
                subColor={data.kpis.expensesMomPct >= 0 ? C.red : C.green} link="expenses" />
              <KpiCard icon="🏦" iconBg={C.amberDim} label="Cash &amp; Bank Balance" value={fmt(data.kpis.cashAndBankBalance)}
                sub="As on today" link="cashflow" />
            </div>

            {/* Ageing donuts + expense category */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <DonutCard title="Payables by Ageing" data={data.payablesAgeing} total={data.kpis.totalPayables} linkId="payables" />
              <DonutCard title="Receivables by Ageing" data={data.receivablesAgeing} total={data.kpis.totalReceivables} linkId="receivables" />
              <DonutCard title="Expenses by Category (MTD)" data={data.expenseByCategory} total={data.kpis.expensesThisMonth} linkId="expenses" />
            </div>

            {/* Top vendor/customer tables + overdue */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <TopEntityTable title="Payables by Vendor (Top 5)" rows={data.payablesByVendor.top} entityLabel="Vendor" linkId="payables-vendor" />
              <TopEntityTable title="Receivables by Customer (Top 5)" rows={data.receivablesByCustomer.top} entityLabel="Customer" linkId="receivables-customer" />
              <OverdueInvoicesCard rows={data.overdueTop} />
            </div>

            {/* Trends */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <TrendChart trend={data.trend} />
              <ExpenseTrendChart trend={data.trend} />
              <SummaryCard summary={data.summary} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
