"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { C, fmt, fmtFull, pct, Sidebar, DateRangeFilter, defaultRange, type DateRange } from "@/lib/dashboard-ui"

interface ReconRow {
  name: string
  invoiced: number
  creditNotes: number
  payments: number
  journals: number
  net: number
}
interface ReconData { rows: ReconRow[] }

interface PlatformRow { name: string; total: number; overdue: number; count: number; pct: number }
interface CombinedRow {
  name: string
  receivable: number; receivableOverdue: number; receivableCount: number
  payable: number; payableOverdue: number; payableCount: number
  net: number
}
interface PlatformsData {
  receivablesByPlatform: PlatformRow[]
  payablesByPlatform: PlatformRow[]
  combined: CombinedRow[]
  asOf: string
}

type SortKey = "name" | "receivable" | "payable" | "net"

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 190, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? C.text, letterSpacing: -0.4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function PlatformsPage() {
  const [data, setData] = useState<PlatformsData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("receivable")
  const [hideEmpty, setHideEmpty] = useState(true)
  const [view, setView] = useState<"balances" | "reconciliation">("reconciliation")
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [recon, setRecon] = useState<ReconData | null>(null)

  useEffect(() => {
    fetch("/api/zoho/platforms", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const loadRecon = (r: DateRange = range) => {
    fetch(`/api/zoho/reconciliation?from=${r.from}&to=${r.to}`, { cache: "no-store" })
      .then(res => res.json())
      .then(d => { if (d.error) setError(d.error); else setRecon(d) })
      .catch(e => setError(String(e)))
  }

  useEffect(() => { loadRecon(range) }, [range])

  const rows = (data?.combined ?? [])
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !hideEmpty || r.receivable !== 0 || r.payable !== 0)
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name)
      if (sortKey === "net") return b.net - a.net
      return (b[sortKey] as number) - (a[sortKey] as number)
    })

  const totalReceivable = rows.reduce((s, r) => s + r.receivable, 0)
  const totalPayable = rows.reduce((s, r) => s + r.payable, 0)

  const chartData = rows.slice(0, 8).map(r => ({ name: r.name, Receivable: r.receivable, Payable: r.payable }))

  const th = (label: string, key: SortKey, align: "left" | "right" = "right") => (
    <th
      onClick={() => setSortKey(key)}
      style={{
        padding: "10px 12px", textAlign: align, fontSize: 10, letterSpacing: 0.5,
        textTransform: "uppercase" as const, fontWeight: 700, cursor: "pointer",
        color: sortKey === key ? C.text : C.dim, whiteSpace: "nowrap" as const,
      }}
    >
      {label}{sortKey === key ? " ↓" : ""}
    </th>
  )

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="platforms" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Platforms</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
              Receivables and payables side by side for every platform. Entities are grouped using your Entity Master
              mapping first, falling back to built-in name matching for anything not yet mapped.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DateRangeFilter value={range} onChange={setRange} />
            <input
              placeholder="Search platform…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13, minWidth: 200, background: C.surface }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 9, width: "fit-content", marginBottom: 18 }}>
          <button onClick={() => setView("reconciliation")} style={{ background: view === "reconciliation" ? C.surface : "transparent", boxShadow: view === "reconciliation" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 7, padding: "7px 15px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: view === "reconciliation" ? C.text : C.dim }}>Settlement Reconciliation</button>
          <button onClick={() => setView("balances")} style={{ background: view === "balances" ? C.surface : "transparent", boxShadow: view === "balances" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 7, padding: "7px 15px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: view === "balances" ? C.text : C.dim }}>Open Balances</button>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {view === "reconciliation" && recon && (() => {
          const shown = recon.rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
          const sum = (k: keyof ReconRow) => shown.reduce((s, r) => s + (r[k] as number), 0)
          const cell = (v: number, color?: string, bold?: boolean) => (
            <td style={{ padding: "11px 12px", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const, color: v ? (color ?? C.text) : C.dim, fontWeight: bold ? 700 : 400 }}>
              {v ? fmtFull(v) : "—"}
            </td>
          )
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Platform Activity — {range.label}</div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
                Invoices raised, less credit notes and payments received, plus any journals. Net is what the platform still owes for this period.
              </div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: C.dim }}>
                      {["Platform", "Invoices Raised", "Credit Notes", "Payments Received", "Journals", "Net"].map((h, i) => (
                        <th key={h} style={{ padding: "11px 12px", textAlign: i === 0 ? "left" as const : "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(r => (
                      <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "11px 12px", fontWeight: 600, whiteSpace: "nowrap" as const }}>{r.name}</td>
                        {cell(r.invoiced)}
                        {cell(r.creditNotes, C.amber)}
                        {cell(r.payments, C.green)}
                        {cell(r.journals, C.dim)}
                        {cell(r.net, r.net >= 0 ? C.text : C.green, true)}
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" as const, color: C.dim }}>No activity in this period</td></tr>
                    )}
                  </tbody>
                  {shown.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700, background: "#FAFBFD" }}>
                        <td style={{ padding: "12px" }}>Total</td>
                        {cell(sum("invoiced"), undefined, true)}
                        {cell(sum("creditNotes"), C.amber, true)}
                        {cell(sum("payments"), C.green, true)}
                        {cell(sum("journals"), C.dim, true)}
                        {cell(sum("net"), undefined, true)}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )
        })()}

        {view === "balances" && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <StatCard label="Total Receivable" value={fmt(totalReceivable)} color={C.green} sub={`${rows.length} platforms`} />
              <StatCard label="Total Payable" value={fmt(totalPayable)} color={C.red} />
              <StatCard label="Net Position" value={fmt(totalReceivable - totalPayable)} color={totalReceivable - totalPayable >= 0 ? C.green : C.red} sub="Receivable minus payable" />
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Receivable vs Payable by Platform</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.border} tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={(v: number) => fmtFull(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Receivable" fill={C.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Payable" fill={C.red} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Platform Detail</div>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.dim, cursor: "pointer" }}>
                  <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
                  Hide platforms with no open balance
                </label>
              </div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {th("Platform", "name", "left")}
                      {th("Receivable", "receivable")}
                      <th style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, fontWeight: 700, color: C.dim }}>R. Overdue</th>
                      {th("Payable", "payable")}
                      <th style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, fontWeight: 700, color: C.dim }}>P. Overdue</th>
                      {th("Net", "net")}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: "20px 12px", textAlign: "center" as const, color: C.dim }}>No platforms found</td></tr>
                    )}
                    {rows.map(r => (
                      <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "11px 12px", fontWeight: 600 }}>
                          {r.name}
                          <div style={{ fontSize: 10, color: C.dim, fontWeight: 500, marginTop: 2 }}>
                            {r.receivableCount + r.payableCount} open docs
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.receivable ? C.text : C.dim }}>{r.receivable ? fmtFull(r.receivable) : "—"}</td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.receivableOverdue ? C.red : C.dim }}>
                          {r.receivableOverdue ? fmtFull(r.receivableOverdue) : "—"}
                          {r.receivable > 0 && r.receivableOverdue > 0 && (
                            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{pct((r.receivableOverdue / r.receivable) * 100)}</div>
                          )}
                        </td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.payable ? C.text : C.dim }}>{r.payable ? fmtFull(r.payable) : "—"}</td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.payableOverdue ? C.red : C.dim }}>
                          {r.payableOverdue ? fmtFull(r.payableOverdue) : "—"}
                          {r.payable > 0 && r.payableOverdue > 0 && (
                            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{pct((r.payableOverdue / r.payable) * 100)}</div>
                          )}
                        </td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, fontWeight: 700, color: r.net >= 0 ? C.green : C.red }}>{fmtFull(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700, background: "#FAFBFD" }}>
                        <td style={{ padding: "12px" }}>Total</td>
                        <td style={{ padding: "12px", textAlign: "right" as const }}>{fmtFull(totalReceivable)}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.red }}>{fmtFull(rows.reduce((s, r) => s + r.receivableOverdue, 0))}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const }}>{fmtFull(totalPayable)}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: C.red }}>{fmtFull(rows.reduce((s, r) => s + r.payableOverdue, 0))}</td>
                        <td style={{ padding: "12px", textAlign: "right" as const, color: totalReceivable - totalPayable >= 0 ? C.green : C.red }}>{fmtFull(totalReceivable - totalPayable)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
