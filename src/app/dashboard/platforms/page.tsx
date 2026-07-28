"use client"
import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { C, fmt, fmtFull, pct, Sidebar } from "@/lib/dashboard-ui"

const DONUT_COLORS = ["#FF6B35", "#F5A623", "#8B5CF6", "#60A5FA", "#22C55E", "#EC4899", "#14B8A6", "#94A3B8"]

interface PlatformRow { name: string; total: number; overdue: number; count: number; pct: number }
interface PlatformsData { receivablesByPlatform: PlatformRow[]; payablesByPlatform: PlatformRow[]; asOf: string }

function PlatformDonut({ title, rows }: { title: string; rows: PlatformRow[] }) {
  const total = rows.reduce((s, r) => s + r.total, 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, flex: 1, minWidth: 340, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={1} strokeWidth={0}>
                {rows.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtFull(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{fmt(total)}</div>
            <div style={{ fontSize: 9, color: C.dim }}>Total</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11, flex: 1 }}>
          {rows.map((r, i) => (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: C.dim }}>{r.name}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{fmt(r.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlatformTable({ title, rows }: { title: string; rows: PlatformRow[] }) {
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandOverdue = rows.reduce((s, r) => s + r.overdue, 0)
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Platform</th>
            <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Open Docs</th>
            <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Total (₹)</th>
            <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Overdue (₹)</th>
            <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>% Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} style={{ padding: "16px 8px", textAlign: "center" as const, color: C.dim }}>No data yet</td></tr>}
          {rows.map(r => (
            <tr key={r.name} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 8px", fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const }}>{r.count}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" as const }}>{pct(r.pct)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
              <td style={{ padding: "10px 8px" }}>Total</td>
              <td />
              <td style={{ padding: "10px 8px", textAlign: "right" as const }}>{fmtFull(grandTotal)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" as const, color: C.red }}>{fmtFull(grandOverdue)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" as const }}>{pct(grandTotal ? (grandOverdue / grandTotal) * 100 : 0)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function PlatformsPage() {
  const [data, setData] = useState<PlatformsData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"receivables" | "payables">("receivables")

  useEffect(() => {
    fetch("/api/zoho/platforms", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="platforms" />
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1200 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Platforms</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>
            Zoho AR/AP grouped by marketplace, matched from vendor/customer names against known platform aliases (Blinkit, Swiggy, Zepto, Amazon, BigBasket, and more)
          </div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading…</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 8, width: "fit-content" }}>
              <button onClick={() => setTab("receivables")} style={{ background: tab === "receivables" ? C.surface : "transparent", boxShadow: tab === "receivables" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: tab === "receivables" ? C.blue : C.dim }}>Receivables (sales via platforms)</button>
              <button onClick={() => setTab("payables")} style={{ background: tab === "payables" ? C.surface : "transparent", boxShadow: tab === "payables" ? "0 1px 2px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, color: tab === "payables" ? C.red : C.dim }}>Payables (fees/logistics to platforms)</button>
            </div>
            {tab === "receivables" ? (
              <>
                <PlatformDonut title="Receivables by Platform" rows={data.receivablesByPlatform} />
                <PlatformTable title="Receivables by Platform — Detail" rows={data.receivablesByPlatform} />
              </>
            ) : (
              <>
                <PlatformDonut title="Payables by Platform" rows={data.payablesByPlatform} />
                <PlatformTable title="Payables by Platform — Detail" rows={data.payablesByPlatform} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
