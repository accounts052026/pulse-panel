"use client"
// Shared implementation behind /dashboard/payables and /dashboard/receivables.
// Both sides show the same thing (entities grouped by canonical/platform name,
// with totals, overdue and doc counts) — only the labels and colours differ,
// so they share one component rather than two near-identical files that drift.
import { useEffect, useState } from "react"
import { C, fmt, fmtFull, pct, Sidebar } from "@/lib/dashboard-ui"

interface GroupedRow { name: string; total: number; overdue: number; count: number; pct: number }
interface RawRow { entity_name: string; canonical_name: string; mapped: boolean; total: number; overdue: number; count: number }
interface EntitiesResponse {
  payables: { raw: RawRow[]; grouped: GroupedRow[] }
  receivables: { raw: RawRow[]; grouped: GroupedRow[] }
}

type SortKey = "name" | "total" | "overdue" | "count"

export function LedgerPage({ side }: { side: "payables" | "receivables" }) {
  const [data, setData] = useState<EntitiesResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("total")
  const [view, setView] = useState<"grouped" | "raw">("grouped")

  useEffect(() => {
    fetch("/api/zoho/entities", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const isPay = side === "payables"
  const entityLabel = isPay ? "Vendor / Platform" : "Customer / Platform"
  const accent = isPay ? C.red : C.blue
  const sideData = data ? (isPay ? data.payables : data.receivables) : null

  const grouped = (sideData?.grouped ?? [])
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortKey === "name" ? a.name.localeCompare(b.name) : (b[sortKey] as number) - (a[sortKey] as number))

  const raw = (sideData?.raw ?? [])
    .filter(r => !search || r.entity_name.toLowerCase().includes(search.toLowerCase()) || r.canonical_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortKey === "name" ? a.entity_name.localeCompare(b.entity_name) : ((b[sortKey === "count" ? "count" : sortKey === "overdue" ? "overdue" : "total"] as number) - (a[sortKey === "count" ? "count" : sortKey === "overdue" ? "overdue" : "total"] as number)))

  const total = grouped.reduce((s, r) => s + r.total, 0)
  const overdue = grouped.reduce((s, r) => s + r.overdue, 0)
  const mappedCount = (sideData?.raw ?? []).filter(r => r.mapped).length

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
      <Sidebar active={side} />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{isPay ? "Payables" : "Receivables"}</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
              Open {isPay ? "bills owed to vendors" : "invoices owed by customers"}, grouped by canonical entity from
              your Entity Master mapping.
            </div>
          </div>
          <input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13, minWidth: 220, background: C.surface }}
          />
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {sideData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 190, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 8 }}>Total Outstanding</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: -0.4 }}>{fmt(total)}</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 190, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 8 }}>Overdue</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.red, letterSpacing: -0.4 }}>{fmt(overdue)}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{pct(total ? (overdue / total) * 100 : 0)} of total</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 190, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.dim, textTransform: "uppercase" as const, marginBottom: 8 }}>Entities</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>{grouped.length}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{mappedCount} of {sideData.raw.length} raw names mapped</div>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {view === "grouped" ? "Grouped by Canonical Entity" : "Raw Zoho Entity Names"}
                </div>
                <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 8 }}>
                  <button onClick={() => setView("grouped")} style={{ background: view === "grouped" ? C.surface : "transparent", boxShadow: view === "grouped" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: 11, color: view === "grouped" ? accent : C.dim }}>Grouped</button>
                  <button onClick={() => setView("raw")} style={{ background: view === "raw" ? C.surface : "transparent", boxShadow: view === "raw" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: 11, color: view === "raw" ? accent : C.dim }}>Raw</button>
                </div>
              </div>

              <div style={{ overflowX: "auto" as const }}>
                {view === "grouped" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {th(entityLabel, "name", "left")}
                        {th("Docs", "count")}
                        {th("Total (₹)", "total")}
                        {th("Overdue (₹)", "overdue")}
                        <th style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, fontWeight: 700, color: C.dim }}>% Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: "20px 12px", textAlign: "center" as const, color: C.dim }}>No entries found</td></tr>
                      )}
                      {grouped.map(r => (
                        <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "11px 12px", fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: C.dim }}>{r.count}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.pct >= 35 ? C.red : r.pct >= 15 ? C.amber : C.dim, fontWeight: 600 }}>{pct(r.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {grouped.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700, background: "#FAFBFD" }}>
                          <td style={{ padding: "12px" }}>Total</td>
                          <td style={{ padding: "12px", textAlign: "right" as const }}>{grouped.reduce((s, r) => s + r.count, 0)}</td>
                          <td style={{ padding: "12px", textAlign: "right" as const }}>{fmtFull(total)}</td>
                          <td style={{ padding: "12px", textAlign: "right" as const, color: C.red }}>{fmtFull(overdue)}</td>
                          <td style={{ padding: "12px", textAlign: "right" as const }}>{pct(total ? (overdue / total) * 100 : 0)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {th("Raw Entity Name (Zoho)", "name", "left")}
                        <th style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, fontWeight: 700, color: C.dim }}>Grouped As</th>
                        {th("Docs", "count")}
                        {th("Total (₹)", "total")}
                        {th("Overdue (₹)", "overdue")}
                      </tr>
                    </thead>
                    <tbody>
                      {raw.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: "20px 12px", textAlign: "center" as const, color: C.dim }}>No entries found</td></tr>
                      )}
                      {raw.map(r => (
                        <tr key={r.entity_name} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "11px 12px", fontWeight: 600 }}>{r.entity_name}</td>
                          <td style={{ padding: "11px 12px" }}>
                            <span style={{ color: r.mapped ? C.green : C.dim, fontWeight: r.mapped ? 600 : 400 }}>{r.canonical_name}</span>
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: C.dim }}>{r.count}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <a href="/dashboard/entities" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: C.blue, fontWeight: 600, textDecoration: "none" }}>
                Edit entity mapping in Entity Master →
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
