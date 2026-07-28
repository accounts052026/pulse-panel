"use client"
import { useEffect, useState, type ReactNode } from "react"
import { C, fmt, fmtFull, pct, Icon, Sidebar } from "@/lib/dashboard-ui"

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
  payablesByVendor: { top: { name: string; total: number; overdue: number; pct: number }[] }
  receivablesByCustomer: { top: { name: string; total: number; overdue: number; pct: number }[] }
  overdueTop: { doc_no: string; party: string; due_date: string; overdue: number; side: "payable" | "receivable" }[]
  summary: { avgPaymentDays: number; avgCollectionDays: number; openInvoices: number; overdueCount: number }
  asOf: string
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

export default function ReportsPage() {
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

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <style>{`@media print { aside, .no-print { display: none !important; } main { padding: 0 !important; max-width: none !important; } body { background: #fff !important; } }`}</style>
      <div className="no-print" style={{ display: "contents" }}>
        <Sidebar active="reports" />
      </div>
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1100 }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Reports</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>Printable finance summary — Payables, Receivables, Expenses &amp; Ageing</div>
          </div>
          <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.accent, color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Icon name="print" size={13} />Print / Save as PDF
          </button>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>CURRYiT — Finance Snapshot</div>
              <div style={{ fontSize: 12, color: C.dim }}>As on {today} · data synced {new Date(data.asOf).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>

            <Section title="Key Metrics">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 13 }}>
                <div><div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase" as const }}>Total Payables</div><div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(data.kpis.totalPayables)}</div><div style={{ color: C.red }}>{fmtFull(data.kpis.payablesOverdue)} overdue ({pct(data.kpis.payablesOverduePct)})</div></div>
                <div><div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase" as const }}>Total Receivables</div><div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(data.kpis.totalReceivables)}</div><div style={{ color: C.red }}>{fmtFull(data.kpis.receivablesOverdue)} overdue ({pct(data.kpis.receivablesOverduePct)})</div></div>
                <div><div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase" as const }}>Expenses (MTD)</div><div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(data.kpis.expensesThisMonth)}</div><div style={{ color: data.kpis.expensesMomPct >= 0 ? C.red : C.green }}>{data.kpis.expensesMomPct >= 0 ? "↑" : "↓"} {pct(Math.abs(data.kpis.expensesMomPct))} vs last month</div></div>
                <div><div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase" as const }}>Cash &amp; Bank</div><div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(data.kpis.cashAndBankBalance)}</div></div>
              </div>
            </Section>

            <Section title="Ageing Summary">
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Payables</div>
                  {data.payablesAgeing.map(a => (
                    <div key={a.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span style={{ color: C.dim }}>{a.label}</span><span style={{ fontWeight: 600 }}>{fmtFull(a.amount)}</span></div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Receivables</div>
                  {data.receivablesAgeing.map(a => (
                    <div key={a.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span style={{ color: C.dim }}>{a.label}</span><span style={{ fontWeight: 600 }}>{fmtFull(a.amount)}</span></div>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Top 5 Payables by Vendor">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {data.payablesByVendor.top.map(r => (
                    <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 4px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" as const, color: C.red }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Top 5 Receivables by Customer">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {data.receivablesByCustomer.top.map(r => (
                    <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 4px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" as const, color: C.red }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Top Overdue Documents">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {data.overdueTop.map(r => (
                    <tr key={r.doc_no} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 4px", fontFamily: "monospace", fontSize: 11 }}>{r.doc_no}</td>
                      <td style={{ padding: "6px 4px" }}>{r.party}</td>
                      <td style={{ padding: "6px 4px", color: C.dim }}>{new Date(r.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" as const, color: C.red, fontWeight: 700 }}>{fmtFull(r.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}
      </main>
    </div>
  )
}
