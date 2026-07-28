"use client"
import { useEffect, useState } from "react"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts"

// ── Design tokens ────────────────────────────────────────────────
const C = {
  bg: "#F5F7FA", surface: "#FFFFFF", border: "#E5E9F0",
  navy: "#0F1B2E", accent: "#FF5A1F",
  green: "#16A34A", greenDim: "#16A34A15",
  red: "#DC2626", redDim: "#DC262612",
  amber: "#D97706", blue: "#2563EB",
  text: "#0F172A", dim: "#64748B",
}
const DONUT_COLORS = ["#16A34A", "#F5B800", "#F5A623", "#F97316", "#DC2626"]
const CAT_COLORS   = ["#2563EB", "#F5A623", "#8B5CF6", "#F97316", "#A78BFA", "#94A3B8"]

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

const NAV = [
  { key: "overview",    label: "Overview",    icon: "⌂" },
  { key: "payables",    label: "Payables",    icon: "▤" },
  { key: "receivables", label: "Receivables", icon: "◈" },
  { key: "expenses",    label: "Expenses",    icon: "▥" },
  { key: "platforms",   label: "Platforms",   icon: "▦" },
  { key: "reports",     label: "Reports",     icon: "▧" },
  { key: "ageing",      label: "Ageing Analysis", icon: "▨" },
  { key: "cashflow",    label: "Cash Flow",   icon: "▩" },
]

function KpiCard({ icon, label, value, sub, subValue, subColor, link }:
  { icon: string; label: string; value: string; sub: string; subValue?: string; subColor?: string; link: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: C.greenDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.dim, textTransform: "uppercase" as const }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
        {sub}{subValue && <span style={{ color: subColor || C.dim, fontWeight: 700 }}> {subValue}</span>}
      </div>
      <a href={`#${link}`} style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 8, display: "inline-block", textDecoration: "none" }}>
        {link.charAt(0).toUpperCase() + link.slice(1)} →
      </a>
    </div>
  )
}

function DonutCard({ title, data, total, linkId }: { title: string; data: { label: string; amount: number }[]; total: number; linkId: string }) {
  const chartData = data.filter(d => d.amount > 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 300 }} id={linkId}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="amount" nameKey="label" innerRadius={45} outerRadius={70} paddingAngle={1}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, flex: 1 }}>
          {chartData.map((d, i) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span style={{ color: C.dim }}>{d.label}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{fmt(d.amount)} ({total ? ((d.amount / total) * 100).toFixed(1) : 0}%)</span>
            </div>
          ))}
        </div>
      </div>
      <a href="/dashboard/entities" style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 10, display: "inline-block", textDecoration: "none" }}>View details →</a>
    </div>
  )
}

function TopEntityTable({ title, rows, entityLabel, linkId }:
  { title: string; rows: { name: string; total: number; overdue: number; pct: number }[]; entityLabel: string; linkId: string }) {
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandOverdue = rows.reduce((s, r) => s + r.overdue, 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 340 }} id={linkId}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <a href="/dashboard/entities" style={{ fontSize: 11, color: C.blue, fontWeight: 600, textDecoration: "none" }}>View all →</a>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>{entityLabel}</th>
            <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" as const }}>Total (₹)</th>
            <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" as const }}>Overdue (₹)</th>
            <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" as const }}>% Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No data yet</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "8px" }}>{r.name}</td>
              <td style={{ padding: "8px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
              <td style={{ padding: "8px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
              <td style={{ padding: "8px", textAlign: "right" as const, color: r.pct > 30 ? C.red : C.dim, fontWeight: 600 }}>{pct(r.pct)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
              <td style={{ padding: "8px" }}>Total</td>
              <td style={{ padding: "8px", textAlign: "right" as const }}>{fmtFull(grandTotal)}</td>
              <td style={{ padding: "8px", textAlign: "right" as const, color: C.red }}>{fmtFull(grandOverdue)}</td>
              <td style={{ padding: "8px", textAlign: "right" as const }}>{pct(grandTotal ? (grandOverdue / grandTotal) * 100 : 0)}</td>
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 340 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Top Overdue Invoices</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <button onClick={() => setTab("payable")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: tab === "payable" ? 700 : 500, color: tab === "payable" ? C.red : C.dim }}>Payables</button>
          <button onClick={() => setTab("receivable")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: tab === "receivable" ? 700 : 500, color: tab === "receivable" ? C.blue : C.dim }}>Receivables</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "4px 8px" }}>Doc No.</th>
            <th style={{ padding: "4px 8px" }}>Vendor / Customer</th>
            <th style={{ padding: "4px 8px" }}>Due Date</th>
            <th style={{ padding: "4px 8px", textAlign: "right" as const }}>Overdue (₹)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No overdue {tab === "payable" ? "bills" : "invoices"}</td></tr>
          )}
          {filtered.map(r => (
            <tr key={r.doc_no} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "8px" }}>{r.doc_no}</td>
              <td style={{ padding: "8px" }}>{r.party}</td>
              <td style={{ padding: "8px" }}>{new Date(r.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td style={{ padding: "8px", textAlign: "right" as const, color: C.red, fontWeight: 600 }}>{fmtFull(r.overdue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendChart({ trend }: { trend: DashboardData["trend"] }) {
  const data = trend.map(t => ({
    month: new Date(t.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Payables: t.payables, Receivables: t.receivables,
  }))
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 340 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Payables vs Receivables Trend</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke={C.border} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={C.dim} />
          <YAxis tick={{ fontSize: 11 }} stroke={C.dim} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={(v: number) => fmtFull(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Payables" stroke={C.red} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Receivables" stroke={C.green} strokeWidth={2} dot={false} />
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 340 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Expense Trend (Last 6 Months)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke={C.border} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={C.dim} />
          <YAxis tick={{ fontSize: 11 }} stroke={C.dim} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={(v: number) => fmtFull(v)} />
          <Bar dataKey="Expenses" fill="#2DBE8F" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SummaryCard({ summary }: { summary: DashboardData["summary"] }) {
  const rows = [
    { icon: "◷", label: "Average Payment Days (Payables)", value: `${summary.avgPaymentDays} Days`, color: C.red },
    { icon: "◔", label: "Average Collection Days (Receivables)", value: `${summary.avgCollectionDays} Days`, color: C.green },
    { icon: "▤", label: "Total Open Invoices", value: String(summary.openInvoices), color: C.text },
    { icon: "⚠", label: "Invoices Overdue", value: String(summary.overdueCount), color: C.amber },
  ]
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, flex: 1, minWidth: 260 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Summary</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

  useEffect(() => {
    fetch("/api/zoho/dashboard", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: C.navy, color: "#fff", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "0 6px" }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>C</div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>CURRYIT</div>
        </div>
        {NAV.map(n => (
          <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: n.key === "overview" ? 700 : 500, background: n.key === "overview" ? "rgba(255,255,255,0.08)" : "transparent", color: n.key === "overview" ? "#fff" : "rgba(255,255,255,0.65)", cursor: "pointer" }}>
            <span>{n.icon}</span>{n.label}
          </div>
        ))}
        <a href="/dashboard/entities" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
          <span>✎</span>Entity Master
        </a>
        <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 12, fontSize: 11, color: "rgba(255,255,255,0.6)", display: "flex", gap: 8, alignItems: "center" }}>
          <span>▣</span>
          <div>Data Source<br /><b style={{ color: "#fff" }}>Zoho Books</b></div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Finance Dashboard</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>Snapshot of Payables, Receivables &amp; Expenses — live from Zoho Books</div>
          </div>
          <div style={{ fontSize: 11, color: C.dim, textAlign: "right" as const }}>
            {data && <>Last updated: {new Date(data.asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>}
          </div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>⟳ Loading live data from Zoho Books…</div>}
        {error && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* KPI row */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <KpiCard icon="◈" label="Total Payables" value={fmt(data.kpis.totalPayables)}
                sub="Overdue:" subValue={`${fmtFull(data.kpis.payablesOverdue)} (${pct(data.kpis.payablesOverduePct)})`} subColor={C.red} link="payables" />
              <KpiCard icon="◇" label="Total Receivables" value={fmt(data.kpis.totalReceivables)}
                sub="Overdue:" subValue={`${fmtFull(data.kpis.receivablesOverdue)} (${pct(data.kpis.receivablesOverduePct)})`} subColor={C.red} link="receivables" />
              <KpiCard icon="▥" label="Total Expenses (MTD)" value={fmt(data.kpis.expensesThisMonth)}
                sub="vs Last Month:" subValue={`${data.kpis.expensesMomPct >= 0 ? "↑" : "↓"} ${pct(Math.abs(data.kpis.expensesMomPct))}`}
                subColor={data.kpis.expensesMomPct >= 0 ? C.red : C.green} link="expenses" />
              <KpiCard icon="▦" label="Cash &amp; Bank Balance" value={fmt(data.kpis.cashAndBankBalance)}
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
