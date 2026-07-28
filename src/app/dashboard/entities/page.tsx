"use client"
import { useEffect, useMemo, useState } from "react"

const C = {
  bg: "#F5F7FA", surface: "#FFFFFF", border: "#E5E9F0",
  navy: "#0F1B2E", accent: "#FF5A1F",
  green: "#16A34A", red: "#DC2626", amber: "#D97706", blue: "#2563EB",
  text: "#0F172A", dim: "#64748B",
}

interface RawEntity {
  entity_name: string
  canonical_name: string
  mapped: boolean
  total: number
  overdue: number
  count: number
}

interface EntitiesResponse {
  payables: { raw: RawEntity[]; grouped: any[]; side: string }
  receivables: { raw: RawEntity[]; grouped: any[]; side: string }
}

function fmtFull(v: number): string {
  return `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

function EntityTable({ side, rows, onSave, onReset, search }:
  { side: "payable" | "receivable"; rows: RawEntity[]; onSave: (r: RawEntity) => void; onReset: (name: string) => void; search: string }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const filtered = rows.filter(r =>
    !search || r.entity_name.toLowerCase().includes(search.toLowerCase()) || r.canonical_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F8FAFC", color: C.dim, textAlign: "left" as const }}>
            <th style={{ padding: "8px 12px" }}>Raw Entity Name (from Zoho)</th>
            <th style={{ padding: "8px 12px" }}>Canonical Vendor / Customer</th>
            <th style={{ padding: "8px 12px", textAlign: "right" as const }}>Total (₹)</th>
            <th style={{ padding: "8px 12px", textAlign: "right" as const }}>Overdue (₹)</th>
            <th style={{ padding: "8px 12px", textAlign: "right" as const }}>Docs</th>
            <th style={{ padding: "8px 12px" }}>Status</th>
            <th style={{ padding: "8px 12px" }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 20, textAlign: "center" as const, color: C.dim }}>No entities found</td></tr>
          )}
          {filtered.map(r => {
            const draft = drafts[r.entity_name] ?? r.canonical_name
            const dirty = draft !== r.canonical_name
            return (
              <tr key={r.entity_name} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.entity_name}</td>
                <td style={{ padding: "8px 12px" }}>
                  <input
                    value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [r.entity_name]: e.target.value }))}
                    style={{ border: `1px solid ${dirty ? C.accent : C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, width: "100%", minWidth: 160 }}
                  />
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" as const }}>{r.count}</td>
                <td style={{ padding: "8px 12px" }}>
                  {r.mapped
                    ? <span style={{ background: "#16A34A15", color: C.green, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>MAPPED</span>
                    : <span style={{ background: "#64748B15", color: C.dim, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>RAW</span>}
                </td>
                <td style={{ padding: "8px 12px", whiteSpace: "nowrap" as const }}>
                  {dirty && (
                    <button
                      onClick={() => { onSave({ ...r, canonical_name: draft }); setDrafts(d => { const n = { ...d }; delete n[r.entity_name]; return n }) }}
                      style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginRight: 6 }}
                    >Save</button>
                  )}
                  {r.mapped && !dirty && (
                    <button onClick={() => onReset(r.entity_name)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: C.dim }}>Reset</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function EntityMasterPage() {
  const [data, setData] = useState<EntitiesResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"payable" | "receivable">("payable")
  const [search, setSearch] = useState("")
  const [msg, setMsg] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/zoho/entities", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const rows = tab === "payable" ? data?.payables.raw ?? [] : data?.receivables.raw ?? []
  const side = tab

  const save = async (r: RawEntity) => {
    await fetch("/api/entity-mapping", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_name: r.entity_name, canonical_name: r.canonical_name, side }),
    })
    setMsg(`Saved: ${r.entity_name} → ${r.canonical_name}`)
    setTimeout(() => setMsg(""), 3000)
    load()
  }

  const reset = async (entity_name: string) => {
    await fetch(`/api/entity-mapping?entity_name=${encodeURIComponent(entity_name)}`, { method: "DELETE" })
    setMsg(`Reset: ${entity_name}`)
    setTimeout(() => setMsg(""), 3000)
    load()
  }

  const mappedCount = useMemo(() => rows.filter(r => r.mapped).length, [rows])

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text, padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <a href="/dashboard" style={{ fontSize: 12, color: C.blue, textDecoration: "none" }}>← Back to Dashboard</a>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Entity Master</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>
            Every vendor/customer name as it appears in Zoho Books. Map duplicates or messy names to one canonical entity — the dashboard groups by the canonical name.
          </div>
        </div>
        <input
          placeholder="Search entity name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 220 }}
        />
      </div>

      {msg && <div style={{ background: "#16A34A15", color: C.green, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{msg}</div>}
      {error && <div style={{ background: "#DC262612", color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}
      {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>⟳ Loading entities from Zoho Books…</div>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#EEF1F6", padding: 4, borderRadius: 10, width: "fit-content" }}>
            <button onClick={() => setTab("payable")} style={{ background: tab === "payable" ? C.accent : "transparent", color: tab === "payable" ? "#fff" : C.text, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Payables / Vendors ({data.payables.raw.length})
            </button>
            <button onClick={() => setTab("receivable")} style={{ background: tab === "receivable" ? C.accent : "transparent", color: tab === "receivable" ? "#fff" : C.text, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Receivables / Customers ({data.receivables.raw.length})
            </button>
            <div style={{ padding: "8px 14px", fontSize: 12, color: C.dim, alignSelf: "center" }}>{mappedCount} of {rows.length} mapped</div>
          </div>

          <EntityTable side={tab} rows={rows} onSave={save} onReset={reset} search={search} />
        </>
      )}
    </div>
  )
}
