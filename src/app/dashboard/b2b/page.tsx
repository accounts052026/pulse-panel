"use client"
import { useEffect, useState } from "react"
import { C, fmt, fmtFull, Sidebar, DateRangeFilter, defaultRange, type DateRange } from "@/lib/dashboard-ui"

interface Milestone { key: string; label: string; due: number; covered: number }
interface B2BInvoice {
  invoice_id: string
  date: string
  invoice_number: string
  customer_name: string
  total: number
  received: number
  balance: number
  status: "Paid" | "Partial" | "Unpaid"
  milestones: Milestone[]
}
interface B2BData {
  customer: string
  invoices: B2BInvoice[]
  receipts: { payment_id: string; date: string; amount: number }[]
  totals: { invoiced: number; received: number; outstanding: number; count: number; paid: number; partial: number; unpaid: number }
  milestoneLabels: string[]
  customers: string[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Paid:    { bg: "#DCFCE7", color: "#15803D" },
  Partial: { bg: "#FEF9C3", color: "#A16207" },
  Unpaid:  { bg: "#F1F5F9", color: "#64748B" },
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

export default function B2BPage() {
  const [data, setData] = useState<B2BData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState("Kulcha Kulture")
  const [range, setRange] = useState<DateRange>(defaultRange)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/zoho/b2b?customer=${encodeURIComponent(customer)}&from=${range.from}&to=${range.to}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setData(d); setError("") } })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [customer, range])

  const pctReceived = data && data.totals.invoiced > 0
    ? (data.totals.received / data.totals.invoiced) * 100
    : 0

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="b2b" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>B2B Tracker</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>
              Order-wise billing and collection against milestone payment terms.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, background: C.surface, minWidth: 200, fontWeight: 600 }}
            >
              <option value="Kulcha Kulture">Kulcha Kulture</option>
              {(data?.customers ?? []).filter(c => c.toLowerCase() !== "kulcha kulture").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {data && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <StatCard label="Total Invoiced" value={fmt(data.totals.invoiced)} sub={`${data.totals.count} invoices`} />
              <StatCard label="Received" value={fmt(data.totals.received)} color={C.green} sub={`${pctReceived.toFixed(1)}% collected`} />
              <StatCard label="Outstanding" value={fmt(data.totals.outstanding)} color={data.totals.outstanding > 0 ? C.red : C.green} />
              <StatCard
                label="Status"
                value={`${data.totals.paid} / ${data.totals.count}`}
                sub={`${data.totals.partial} partial · ${data.totals.unpaid} unpaid`}
              />
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Invoices — {data.customer}</div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
                Milestone columns show the amount due at each stage, and how much of it the receipts so far cover.
              </div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 980 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: C.dim }}>
                      {["Date", "Invoice No.", "Amount", "Received", "Balance", "Status"].map((h, i) => (
                        <th key={h} style={{ padding: "11px 12px", textAlign: i >= 2 && i <= 4 ? "right" as const : "left" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                      {["50% Advance", "30% Dispatch", "20% Delivery"].map(h => (
                        <th key={h} style={{ padding: "11px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 24, textAlign: "center" as const, color: C.dim }}>No invoices for this customer in the selected period</td></tr>
                    )}
                    {data.invoices.map(inv => {
                      const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.Unpaid
                      return (
                        <tr key={inv.invoice_id} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "11px 12px", color: C.dim, whiteSpace: "nowrap" as const }}>
                            {inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td style={{ padding: "11px 12px", fontFamily: "monospace", fontSize: 11.5 }}>{inv.invoice_number}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, fontWeight: 600, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(inv.total)}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: inv.received ? C.green : C.dim, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{inv.received ? fmtFull(inv.received) : "—"}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: inv.balance ? C.red : C.dim, fontWeight: inv.balance ? 700 : 400, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{inv.balance ? fmtFull(inv.balance) : "—"}</td>
                          <td style={{ padding: "11px 12px" }}>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" as const }}>{inv.status}</span>
                          </td>
                          {inv.milestones.map(m => {
                            const full = m.due > 0 && m.covered >= m.due - 0.5
                            return (
                              <td key={m.key} style={{ padding: "11px 12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const, background: full ? "#F0FDF4" : undefined }}>
                                <div style={{ fontWeight: 600 }}>{fmtFull(m.due)}</div>
                                <div style={{ fontSize: 10, color: full ? C.green : C.dim, marginTop: 2 }}>
                                  {full ? "received" : m.covered > 0 ? `${fmtFull(m.covered)} in` : "pending"}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                  {data.invoices.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700, background: "#FAFBFD" }}>
                        <td style={{ padding: "12px" }} colSpan={2}>Total</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.totals.invoiced)}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.green, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.totals.received)}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.red, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(data.totals.outstanding)}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {data.receipts.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Payments Received</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: C.dim }}>
                      <th style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Date</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.receipts.map(r => (
                      <tr key={r.payment_id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 12px", color: C.dim }}>
                          {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontWeight: 600, color: C.green, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const }}>{fmtFull(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
