"use client"
import { useState } from "react"
// ── Shared dashboard chrome (tokens, icons, sidebar) ────────────
// Used by every /dashboard/* page so the sidebar nav, colors, and
// number formatting stay consistent instead of being copy-pasted
// (and drifting) across files.

export const C = {
  bg: "#F5F7FA", surface: "#FFFFFF", border: "#E9ECF2",
  navy: "#0F1B2E", accent: "#FF5A1F",
  green: "#16A34A", greenDim: "#16A34A15",
  red: "#DC2626", redDim: "#FDEDEC",
  amber: "#D97706", amberDim: "#FDF3E7",
  blue: "#2563EB", blueDim: "#EAF1FE",
  text: "#0F172A", dim: "#8A94A6",
}

export function fmt(v: number): string {
  if (isNaN(v) || !isFinite(v)) return "—"
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
export function fmtFull(v: number): string {
  return `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
export function pct(v: number) { return `${v.toFixed(1)}%` }

// ── Line icons (no emoji) ───────────────────────────────────────
export function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const s = { width: size, height: size, stroke: "currentColor", strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "overview":   return <svg viewBox="0 0 24 24" {...s}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>
    case "payables":   return <svg viewBox="0 0 24 24" {...s}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9h17M8 13h4" /></svg>
    case "receivables":return <svg viewBox="0 0 24 24" {...s}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 10.5h19M6 14.5h4" /></svg>
    case "expenses":   return <svg viewBox="0 0 24 24" {...s}><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M9 12h6M9 16h6M9 8h3" /></svg>
    case "ageing":     return <svg viewBox="0 0 24 24" {...s}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
    case "cashflow":   return <svg viewBox="0 0 24 24" {...s}><path d="M3 17c3-5 5-7 9-7s6 2 9 7" /><path d="M15 8v2h2" /></svg>
    case "platforms":  return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="8" height="8" rx="1.5" /><rect x="13" y="4" width="8" height="8" rx="1.5" /><rect x="3" y="14" width="8" height="6" rx="1.5" /><rect x="13" y="14" width="8" height="6" rx="1.5" /></svg>
    case "reports":    return <svg viewBox="0 0 24 24" {...s}><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M8 16v-4M12 16V8M16 16v-2" /></svg>
    case "b2b":        return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>
    case "d2c":        return <svg viewBox="0 0 24 24" {...s}><path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8Z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></svg>
    case "entities":   return <svg viewBox="0 0 24 24" {...s}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
    case "settings":   return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
    case "calendar":   return <svg viewBox="0 0 24 24" {...s}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
    case "refresh":    return <svg viewBox="0 0 24 24" {...s}><path d="M4 4v5h5M20 20v-5h-5" /><path d="M4.6 15A8 8 0 0 0 20 12a8 8 0 0 0-7-7.9M19.4 9A8 8 0 0 0 4 12a8 8 0 0 0 7 7.9" /></svg>
    case "database":   return <svg viewBox="0 0 24 24" {...s}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" /><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /></svg>
    case "wallet":     return <svg viewBox="0 0 24 24" {...s}><path d="M3.5 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" /><path d="M14.5 12.5h4v3h-4a1.5 1.5 0 0 1 0-3Z" /></svg>
    case "bank":       return <svg viewBox="0 0 24 24" {...s}><path d="M3 10 12 4l9 6" /><path d="M4.5 10v9M9.5 10v9M14.5 10v9M19.5 10v9" /><path d="M3 19h18" /></svg>
    case "clock":      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
    case "check":      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="8.5" /><path d="m8 12.5 2.5 2.5L16 9.5" /></svg>
    case "warning":    return <svg viewBox="0 0 24 24" {...s}><path d="M12 4 2 20h20Z" /><path d="M12 10.5v4.2M12 17.2h.01" /></svg>
    case "doc":        return <svg viewBox="0 0 24 24" {...s}><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /></svg>
    case "download":   return <svg viewBox="0 0 24 24" {...s}><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
    case "print":      return <svg viewBox="0 0 24 24" {...s}><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="1.5" /><path d="M6 15h12v6H6Z" /></svg>
    default:           return null
  }
}

export const NAV = [
  { key: "overview",    label: "Overview",         icon: "overview",   href: "/dashboard" },
  { key: "payables",    label: "Payables",         icon: "payables",   href: "/dashboard/payables" },
  { key: "receivables", label: "Receivables",      icon: "receivables",href: "/dashboard/receivables" },
  { key: "expenses",    label: "Expenses",         icon: "expenses",   href: "/dashboard#expenses" },
  { key: "ageing",      label: "Ageing Analysis",  icon: "ageing",     href: "/dashboard/ageing" },
  { key: "cashflow",    label: "Cash Flow",        icon: "cashflow",   href: "/dashboard/cashflow" },
  { key: "platforms",   label: "Platforms",        icon: "platforms",  href: "/dashboard/platforms" },
  { key: "b2b",         label: "B2B Tracker",      icon: "b2b",        href: "/dashboard/b2b" },
  { key: "d2c",         label: "D2C Overview",     icon: "d2c",        href: "/dashboard/d2c" },
  { key: "reports",     label: "Reports",          icon: "reports",    href: "/dashboard/reports" },
]

// ── Date range ──────────────────────────────────────────────────
// Indian financial year: 1 April → 31 March.
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function financialYearRange(ref = new Date()): { from: string; to: string } {
  // Months are 0-indexed, so March is 2 — anything from April (3) onward
  // belongs to the FY starting this calendar year.
  const startYear = ref.getMonth() >= 3 ? ref.getFullYear() : ref.getFullYear() - 1
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}

export interface DateRange { from: string; to: string; label: string }

export function defaultRange(): DateRange {
  const fy = financialYearRange()
  const startYear = Number(fy.from.slice(0, 4))
  return { ...fy, label: `FY ${startYear}-${String(startYear + 1).slice(2)}` }
}

export function rangePresets(ref = new Date()): DateRange[] {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const fy = financialYearRange(ref)
  const fyStartYear = Number(fy.from.slice(0, 4))
  const prevFyStart = fyStartYear - 1

  const monthStart = new Date(y, m, 1)
  const lastMonthStart = new Date(y, m - 1, 1)
  const lastMonthEnd = new Date(y, m, 0)
  const quarterStart = new Date(y, Math.floor(m / 3) * 3, 1)

  return [
    { ...fy, label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}` },
    { from: `${prevFyStart}-04-01`, to: `${prevFyStart + 1}-03-31`, label: `FY ${prevFyStart}-${String(prevFyStart + 1).slice(2)}` },
    { from: iso(quarterStart), to: iso(ref), label: "This Quarter" },
    { from: iso(monthStart), to: iso(ref), label: "This Month" },
    { from: iso(lastMonthStart), to: iso(lastMonthEnd), label: "Last Month" },
    { from: "1900-01-01", to: "2999-12-31", label: "All Time" },
  ]
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(value.from)
  const [customTo, setCustomTo] = useState(value.to)
  const presets = rangePresets()

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7, border: `1px solid ${C.border}`,
          background: C.surface, borderRadius: 9, padding: "8px 12px", fontSize: 12,
          color: C.text, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Icon name="calendar" size={13} />
        {value.label}
        <span style={{ color: C.dim, fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 21,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)", padding: 10, minWidth: 250,
          }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { onChange(p); setOpen(false) }}
                style={{
                  display: "block", width: "100%", textAlign: "left" as const, border: "none",
                  background: p.label === value.label ? "#F1F5F9" : "transparent",
                  borderRadius: 7, padding: "8px 10px", fontSize: 12.5, cursor: "pointer",
                  fontWeight: p.label === value.label ? 700 : 500, color: C.text,
                }}
              >{p.label}</button>
            ))}

            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8 }}>Custom</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 0 }} />
                <span style={{ color: C.dim, fontSize: 11 }}>to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 0 }} />
              </div>
              <button
                onClick={() => {
                  if (!customFrom || !customTo) return
                  onChange({ from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` })
                  setOpen(false)
                }}
                style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >Apply</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Sidebar({ active }: { active: string }) {
  return (
    // sticky + own scroll so the nav stays put instead of scrolling out of
    // view and leaving an empty dark column beside the content.
    <aside style={{
      width: 224, background: C.navy, color: "#fff", padding: "20px 14px",
      display: "flex", flexDirection: "column", gap: 3,
      position: "sticky", top: 0, height: "100vh",
      alignSelf: "flex-start", flexShrink: 0, overflowY: "auto" as const,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 26, padding: "0 6px" }}>
        <div style={{ width: 30, height: 30, background: C.accent, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>C</div>
        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>CURRYIT</div>
      </div>
      {NAV.map(n => (
        <a key={n.key} href={n.href} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: n.key === active ? 700 : 500, background: n.key === active ? "rgba(255,255,255,0.10)" : "transparent", color: n.key === active ? "#fff" : "rgba(255,255,255,0.62)", textDecoration: "none" }}>
          <Icon name={n.icon} />{n.label}
        </a>
      ))}
      <a href="/dashboard/entities" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: active === "entities" ? 700 : 500, background: active === "entities" ? "rgba(255,255,255,0.10)" : "transparent", color: active === "entities" ? "#fff" : "rgba(255,255,255,0.62)", textDecoration: "none" }}>
        <Icon name="entities" />Entity Master
      </a>
      <a href="/dashboard/settings" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: active === "settings" ? 700 : 500, background: active === "settings" ? "rgba(255,255,255,0.10)" : "transparent", color: active === "settings" ? "#fff" : "rgba(255,255,255,0.62)", textDecoration: "none" }}>
        <Icon name="settings" />Settings
      </a>
      <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 13, fontSize: 11, color: "rgba(255,255,255,0.6)", display: "flex", gap: 9, alignItems: "center" }}>
        <Icon name="database" size={18} />
        <div>Data Source<br /><b style={{ color: "#fff" }}>Zoho Books</b></div>
      </div>
    </aside>
  )
}

// Reusable sync-all-modules loop, shared by the main dashboard and Settings
// page. Each call to /api/zoho/sync?module=X pulls just a few pages and
// reports done:true once that module has no more pages left — looping here
// makes forward progress instead of one long request timing out.
export const ZOHO_MODULES_UI = ["invoices", "bills", "creditnotes", "vendorcredits", "customerpayments", "vendorpayments", "journals", "expenses", "bankaccounts"]

export async function runZohoSync(onProgress: (msg: string) => void): Promise<{ failed: number }> {
  let failed = 0
  for (let i = 0; i < ZOHO_MODULES_UI.length; i++) {
    const m = ZOHO_MODULES_UI[i]
    let done = false
    let batch = 0
    let rowsSoFar = 0
    while (!done) {
      batch++
      onProgress(`Syncing ${m}… module ${i + 1}/${ZOHO_MODULES_UI.length}, batch ${batch} (${rowsSoFar} rows so far)`)
      try {
        const res = await fetch(`/api/zoho/sync?module=${m}`, { method: "POST" })
        const text = await res.text()
        let d: any
        try { d = JSON.parse(text) } catch { d = { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 120)}` } }
        if (d.error) { failed++; break }
        done = !!d.done
        rowsSoFar = d.totalRows ?? rowsSoFar
        if (batch > 50) break
      } catch {
        failed++
        break
      }
    }
  }
  return { failed }
}
