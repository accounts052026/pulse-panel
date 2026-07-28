"use client"
import { useEffect, useMemo, useState } from "react"
import { C, fmtFull, Sidebar } from "@/lib/dashboard-ui"

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

export default function EntityMasterPage() {
  const [data, setData] = useState<EntitiesResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"payable" | "receivable">("payable")
  const [search, setSearch] = useState("")
  const [msg, setMsg] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState("")
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/zoho/entities", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setData(d); setError("") } })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const rows = tab === "payable" ? data?.payables.raw ?? [] : data?.receivables.raw ?? []
  const side = tab

  const filtered = rows.filter(r =>
    !search ||
    r.entity_name.toLowerCase().includes(search.toLowerCase()) ||
    r.canonical_name.toLowerCase().includes(search.toLowerCase())
  )

  const mappedCount = useMemo(() => rows.filter(r => r.mapped).length, [rows])

  // Distinct canonical names already in use — offered as quick bulk targets
  // so related entities get merged under an identical spelling every time.
  const existingCanonicals = useMemo(() => {
    const all = [...(data?.payables.raw ?? []), ...(data?.receivables.raw ?? [])]
    return Array.from(new Set(all.filter(r => r.mapped).map(r => r.canonical_name))).sort()
  }, [data])

  const postMapping = async (entity_name: string, canonical_name: string) => {
    const res = await fetch("/api/entity-mapping", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_name, canonical_name, side }),
    })
    const text = await res.text()
    let d: any
    try { d = JSON.parse(text) } catch { d = { error: `Non-JSON response (${res.status}): ${text.slice(0, 160)}` } }
    if (!res.ok || d.error) throw new Error(d.error || res.statusText)
    return d
  }

  const save = async (entity_name: string, canonical_name: string) => {
    setBusy(true); setError("")
    try {
      await postMapping(entity_name, canonical_name)
      setDrafts(d => { const n = { ...d }; delete n[entity_name]; return n })
      setMsg(`Saved: ${entity_name} → ${canonical_name}`)
      setTimeout(() => setMsg(""), 3000)
      load()
    } catch (e) {
      setError(`Save failed for "${entity_name}": ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const bulkSave = async () => {
    const target = bulkTarget.trim()
    if (!target || selected.size === 0) return
    setBusy(true); setError("")
    let ok = 0
    try {
      for (const entity_name of Array.from(selected)) {
        await postMapping(entity_name, target)
        ok++
      }
      setMsg(`Mapped ${ok} ${ok === 1 ? "entity" : "entities"} → ${target}`)
      setSelected(new Set())
      setBulkTarget("")
      setTimeout(() => setMsg(""), 4000)
      load()
    } catch (e) {
      setError(`Bulk map stopped after ${ok} saved: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const reset = async (entity_name: string) => {
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/entity-mapping?entity_name=${encodeURIComponent(entity_name)}`, { method: "DELETE" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) throw new Error(d.error || res.statusText)
      setMsg(`Reset: ${entity_name}`)
      setTimeout(() => setMsg(""), 3000)
      load()
    } catch (e) {
      setError(`Reset failed for "${entity_name}": ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const toggle = (name: string) => setSelected(s => {
    const n = new Set(s)
    if (n.has(name)) n.delete(name); else n.add(name)
    return n
  })

  const allVisibleSelected = filtered.length > 0 && filtered.every(r => selected.has(r.entity_name))

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="entities" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Entity Master</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4, maxWidth: 780, lineHeight: 1.5 }}>
              One platform trades under many legal entity names. Map them all to a single platform name here and every
              screen — Overview, Payables, Receivables, Ageing, Platforms — groups by that name instead of the raw Zoho ones.
            </div>
          </div>
          <input
            placeholder="Search entity name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13, minWidth: 240, background: C.surface }}
          />
        </div>

        {msg && <div style={{ background: "#16A34A15", color: C.green, padding: "10px 14px", borderRadius: 9, fontSize: 12.5, marginBottom: 12, fontWeight: 600 }}>{msg}</div>}
        {error && <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}
        {loading && <div style={{ textAlign: "center" as const, padding: 60, color: C.dim }}>Loading entities…</div>}

        {data && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4, background: "#F1F3F7", padding: 3, borderRadius: 9 }}>
                <button onClick={() => { setTab("payable"); setSelected(new Set()) }} style={{ background: tab === "payable" ? C.accent : "transparent", color: tab === "payable" ? "#fff" : C.dim, border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  Payables / Vendors ({data.payables.raw.length})
                </button>
                <button onClick={() => { setTab("receivable"); setSelected(new Set()) }} style={{ background: tab === "receivable" ? C.accent : "transparent", color: tab === "receivable" ? "#fff" : C.dim, border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  Receivables / Customers ({data.receivables.raw.length})
                </button>
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>{mappedCount} of {rows.length} mapped</div>
            </div>

            {/* Bulk mapping bar — the core workflow: several entities, one platform */}
            <div style={{
              background: selected.size ? "#FFF7ED" : C.surface,
              border: `1px solid ${selected.size ? C.accent + "55" : C.border}`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: selected.size ? C.text : C.dim }}>
                {selected.size ? `${selected.size} selected` : "Select rows to map several entities to one platform"}
              </span>
              <input
                placeholder="Platform / canonical name…"
                value={bulkTarget}
                onChange={e => setBulkTarget(e.target.value)}
                list="canonical-options"
                disabled={!selected.size}
                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, minWidth: 240, background: selected.size ? "#fff" : "#F8FAFC" }}
              />
              <datalist id="canonical-options">
                {existingCanonicals.map(c => <option key={c} value={c} />)}
              </datalist>
              <button
                onClick={bulkSave}
                disabled={!selected.size || !bulkTarget.trim() || busy}
                style={{
                  background: (!selected.size || !bulkTarget.trim() || busy) ? "#CBD5E1" : C.accent,
                  color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
                  fontSize: 12.5, fontWeight: 700, cursor: (!selected.size || !bulkTarget.trim() || busy) ? "not-allowed" : "pointer",
                }}
              >{busy ? "Saving…" : "Map selected"}</button>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear</button>
              )}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" as const, minWidth: 940 }}>
                <colgroup>
                  <col style={{ width: 42 }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", color: C.dim, textAlign: "left" as const }}>
                    <th style={{ padding: "11px 12px" }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.entity_name)) : new Set())}
                      />
                    </th>
                    <th style={{ padding: "11px 12px", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Raw Entity Name (from Zoho)</th>
                    <th style={{ padding: "11px 12px", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Canonical / Platform</th>
                    <th style={{ padding: "11px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Total (₹)</th>
                    <th style={{ padding: "11px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Overdue (₹)</th>
                    <th style={{ padding: "11px 12px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Docs</th>
                    <th style={{ padding: "11px 12px", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const, fontWeight: 700 }}>Status</th>
                    <th style={{ padding: "11px 12px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 24, textAlign: "center" as const, color: C.dim }}>No entities found</td></tr>
                  )}
                  {filtered.map(r => {
                    const draft = drafts[r.entity_name] ?? r.canonical_name
                    const dirty = draft !== r.canonical_name
                    const isSel = selected.has(r.entity_name)
                    return (
                      <tr key={r.entity_name} style={{ borderTop: `1px solid ${C.border}`, background: isSel ? "#FFF7ED" : undefined }}>
                        <td style={{ padding: "11px 12px" }}>
                          <input type="checkbox" checked={isSel} onChange={() => toggle(r.entity_name)} />
                        </td>
                        <td style={{ padding: "11px 12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={r.entity_name}>{r.entity_name}</td>
                        <td style={{ padding: "11px 12px" }}>
                          <input
                            value={draft}
                            onChange={e => setDrafts(d => ({ ...d, [r.entity_name]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter" && dirty) save(r.entity_name, draft) }}
                            list="canonical-options"
                            title={draft}
                            style={{ border: `1px solid ${dirty ? C.accent : C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, width: "100%", boxSizing: "border-box" as const, background: r.mapped && !dirty ? "#F0FDF4" : "#fff" }}
                          />
                        </td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const }}>{fmtFull(r.total)}</td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: r.overdue ? C.red : C.dim }}>{r.overdue ? fmtFull(r.overdue) : "—"}</td>
                        <td style={{ padding: "11px 12px", textAlign: "right" as const, color: C.dim }}>{r.count}</td>
                        <td style={{ padding: "11px 12px" }}>
                          {r.mapped
                            ? <span style={{ background: "#16A34A15", color: C.green, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 10, whiteSpace: "nowrap" as const }}>MAPPED</span>
                            : <span style={{ background: "#64748B15", color: C.dim, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 10, whiteSpace: "nowrap" as const }}>RAW</span>}
                        </td>
                        <td style={{ padding: "11px 12px", whiteSpace: "nowrap" as const }}>
                          {dirty && (
                            <button
                              onClick={() => save(r.entity_name, draft)}
                              disabled={busy}
                              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer", marginRight: 6 }}
                            >Save</button>
                          )}
                          {r.mapped && !dirty && (
                            <button onClick={() => reset(r.entity_name)} disabled={busy} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: busy ? "wait" : "pointer", color: C.dim }}>Reset</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
