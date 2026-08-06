"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { C, fmt, fmtFull, Sidebar } from "@/lib/dashboard-ui"

interface Gateway { name: string; amount: number; fee: number; tax: number; credit: number; netCredit: number }
interface D2CData {
  totals: {
    orders: number; invoiced: number; credits: number; netInvoice: number
    paid: number; pending: number; voided: number
    paidValue: number; pendingValue: number
    totalFees: number; totalSettled: number
  }
  gateways: Gateway[]
  trend: { month: string; invoiced: number; net: number; orders: number }[]
  recentOrders: { date: string; doc: string; customer: string; status: string; invoice: number; net: number }[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid:    { bg: "#DCFCE7", color: "#15803D" },
  pending: { bg: "#FEF9C3", color: "#A16207" },
  voided:  { bg: "#FEE2E2", color: "#B91C1C" },
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 180, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? C.text, letterSpacing: -0.4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function D2CPage() {
  const [data, setData] = useState<D2CData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/d2c", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const chartData = (data?.trend ?? []).map(t => ({
    month: new Date(t.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    Invoiced: t.invoiced,
    Net: t.net,
  }))

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="d2c" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1280 }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>D2C Overview</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>
            Direct-to-consumer orders and gateway settlements, from the D2C Customer Statement sheet.
          </div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <StatCard label="Orders" value={data.totals.orders.toLocaleString("en-IN")}
                sub={`${data.totals.paid} paid · ${data.totals.pending} pending · ${data.totals.voided} voided`} />
              <StatCard label="Net Invoiced" value={fmt(data.totals.netInvoice)}
                sub={data.totals.credits ? `after ${fmt(data.totals.credits)} credits` : undefined} />
              <StatCard label="Collected" value={fmt(data.totals.paidValue)} color={C.green}
                sub={data.totals.netInvoice > 0 ? `${((data.totals.paidValue / data.totals.netInvoice) * 100).toFixed(1)}% of net` : undefined} />
              <StatCard label="Pending" value={fmt(data.totals.pendingValue)} color={data.totals.pendingValue > 0 ? C.amber : C.dim} />
              <StatCard label="Gateway Fees" value={fmt(data.totals.totalFees)} color={C.red}
                sub="incl. tax" />
            </div>

            {data.gateways.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Payment Gateways</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>
                  What each gateway collected, what it charged, and what actually settled to the bank.
                </div>
                <div style={{ overflowX: "auto" as const }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC", color: C.dim }}>
                        {["Gateway", "Collected", "Fee", "Tax", "Settled", "Fee %"].map((h, i) => (
                          <th key={h} style={{ padding: "11px 12px", textAlign: i === 0 ? "left" as const : "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700, whiteSpace: "nowrap" as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.gateways.map(g => (
                        <tr key={g.name} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "11px 12px", fontWeight: 600 }}>{g.name}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(g.amount)}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: g.fee ? C.red : C.dim, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{g.fee ? fmtFull(g.fee) : "—"}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: C.dim, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{g.tax ? fmtFull(g.tax) : "—"}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, fontWeight: 700, color: C.green, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(g.netCredit)}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: C.dim }}>
                            {g.amount > 0 ? `${(((g.fee + g.tax) / g.amount) * 100).toFixed(2)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700, background: "#FAFBFD" }}>
                        <td style={{ padding: "12px" }}>Total</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.gateways.reduce((s, g) => s + g.amount, 0))}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.red, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.gateways.reduce((s, g) => s + g.fee, 0))}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.dim, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.gateways.reduce((s, g) => s + g.tax, 0))}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.green, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.totals.totalSettled)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {chartData.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Sales</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmtFull(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Invoiced" fill={C.blue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Net" fill="#2DBE8F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Recent Orders</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: C.dim }}>
                      {["Date", "Document No.", "Customer", "Status", "Invoice", "Net"].map((h, i) => (
                        <th key={h} style={{ padding: "11px 12px", textAlign: i >= 4 ? "right" as const : "left" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o, i) => {
                      const st = STATUS_STYLE[o.status] ?? { bg: "#F1F5F9", color: C.dim }
                      return (
                        <tr key={`${o.doc}-${i}`} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "10px 12px", color: C.dim, whiteSpace: "nowrap" as const }}>
                            {o.date ? new Date(o.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11.5 }}>{o.doc}</td>
                          <td style={{ padding: "10px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 220 }} title={o.customer}>{o.customer}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "capitalize" as const }}>{o.status}</span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(o.invoice)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, fontWeight: 600, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(o.net)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 12 }}>Showing the 50 most recent orders.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
