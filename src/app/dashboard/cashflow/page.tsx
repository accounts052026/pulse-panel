"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { C, fmt, fmtFull, Icon, Sidebar } from "@/lib/dashboard-ui"

interface CashflowData {
  totalBalance: number
  accounts: { account_id: string; account_name: string; balance: number }[]
  trend: { month: string; inflow: number; outflow: number; net: number }[]
  inflowThisMonth: number
  outflowThisMonth: number
  netThisMonth: number
  asOf: string
}

export default function CashflowPage() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/zoho/cashflow", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const trendData = data?.trend.map(t => ({
    month: new Date(t.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Inflow: t.inflow, Outflow: t.outflow, Net: t.net,
  })) ?? []

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="cashflow" />
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1200 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Cash Flow</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>Bank balances and monthly cash inflow vs outflow</div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", flex: 1, minWidth: 220, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: C.amberDim, color: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="bank" size={16} /></div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const }}>Total Balance</div>
                </div>
                <div style={{ fontSize: 23, fontWeight: 800 }}>{fmt(data.totalBalance)}</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", flex: 1, minWidth: 220, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 10 }}>Inflow (MTD)</div>
                <div style={{ fontSize: 23, fontWeight: 800, color: C.green }}>{fmt(data.inflowThisMonth)}</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", flex: 1, minWidth: 220, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 10 }}>Outflow (MTD)</div>
                <div style={{ fontSize: 23, fontWeight: 800, color: C.red }}>{fmt(data.outflowThisMonth)}</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", flex: 1, minWidth: 220, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 10 }}>Net (MTD)</div>
                <div style={{ fontSize: 23, fontWeight: 800, color: data.netThisMonth >= 0 ? C.green : C.red }}>{fmt(data.netThisMonth)}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 2, minWidth: 420, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Inflow vs Outflow (Last 6 Months)</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trendData}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmtFull(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Inflow" fill={C.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Outflow" fill={C.red} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 300, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Bank Accounts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.accounts.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>No accounts synced yet</div>}
                  {data.accounts.map(a => (
                    <div key={a.account_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.account_name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtFull(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Net Cash Trend</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} />
                  <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={(v: number) => fmtFull(v)} />
                  <Line type="monotone" dataKey="Net" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
