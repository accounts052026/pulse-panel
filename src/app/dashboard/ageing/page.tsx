"use client"
import { useEffect, useState } from "react"
import { C, fmtFull, Sidebar } from "@/lib/dashboard-ui"

interface EntityAgeing { name: string; buckets: Record<string, number>; total: number }
interface AgeingData { buckets: string[]; payables: EntityAgeing[]; receivables: EntityAgeing[]; asOf: string }

function AgeingTable({ title, rows, buckets, entityLabel }: { title: string; rows: EntityAgeing[]; buckets: string[]; entityLabel: string }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, 15)
  const totals = buckets.map(b => rows.reduce((s, r) => s + (r.buckets[b] || 0), 0))
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      <div style={{ overflowX: "auto" as const }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" as const }}>
              <th style={{ padding: "4px 8px 8px", fontWeight: 600, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>{entityLabel}</th>
              {buckets.map(b => (
                <th key={b} style={{ padding: "4px 8px 8px", fontWeight: 600, textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{b}</th>
              ))}
              <th style={{ padding: "4px 8px 8px", fontWeight: 600, textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={buckets.length + 2} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No data yet</td></tr>
            )}
            {visible.map(r => (
              <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "9px 8px", fontWeight: 600 }}>{r.name}</td>
                {buckets.map(b => (
                  <td key={b} style={{ padding: "9px 8px", textAlign: "right" as const, color: r.buckets[b] ? C.text : C.dim }}>
                    {r.buckets[b] ? fmtFull(r.buckets[b]) : "—"}
                  </td>
                ))}
                <td style={{ padding: "9px 8px", textAlign: "right" as const, fontWeight: 700 }}>{fmtFull(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                <td style={{ padding: "10px 8px" }}>Total</td>
                {totals.map((t, i) => (
                  <td key={buckets[i]} style={{ padding: "10px 8px", textAlign: "right" as const }}>{fmtFull(t)}</td>
                ))}
                <td style={{ padding: "10px 8px", textAlign: "right" as const }}>{fmtFull(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > 15 && (
        <button onClick={() => setShowAll(s => !s)} style={{ marginTop: 10, background: "none", border: "none", color: C.blue, fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0 }}>
          {showAll ? "Show top 15" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

export default function AgeingPage() {
  const [data, setData] = useState<AgeingData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"payables" | "receivables">("payables")

  useEffect(() => {
    fetch("/api/zoho/ageing", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="ageing" />
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1200 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Ageing Analysis</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>Outstanding balances by vendor/customer, broken down by how overdue they are</div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 8, width: "fit-content" }}>
              <button onClick={() => setTab("payables")} style={{ background: tab === "payables" ? C.surface : "transparent", boxShadow: tab === "payables" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: tab === "payables" ? C.red : C.dim }}>Payables</button>
              <button onClick={() => setTab("receivables")} style={{ background: tab === "receivables" ? C.surface : "transparent", boxShadow: tab === "receivables" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: tab === "receivables" ? C.blue : C.dim }}>Receivables</button>
            </div>
            {tab === "payables"
              ? <AgeingTable title="Payables by Vendor" rows={data.payables} buckets={data.buckets} entityLabel="Vendor" />
              : <AgeingTable title="Receivables by Customer" rows={data.receivables} buckets={data.buckets} entityLabel="Customer" />}
          </div>
        )}
      </main>
    </div>
  )
}
