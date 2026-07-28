"use client"
import { useEffect, useState } from "react"
import { C, Icon, Sidebar, runZohoSync } from "@/lib/dashboard-ui"

interface SyncStatusRow { module: string; row_count: number; synced_at: string; error: string | null }

const MODULE_LABELS: Record<string, string> = {
  invoices: "Invoices", bills: "Bills", creditnotes: "Credit Notes", vendorcredits: "Vendor Credits",
  customerpayments: "Customer Payments", vendorpayments: "Vendor Payments", journals: "Journals",
  expenses: "Expenses", bankaccounts: "Bank Accounts",
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SyncStatusRow[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/zoho/sync?status=1", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStatus(d.status) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const syncNow = async () => {
    setSyncing(true); setSyncMsg("")
    const { failed } = await runZohoSync(msg => setSyncMsg(msg))
    setSyncMsg(failed ? `Synced with ${failed} module(s) failing — see table below` : "Synced from Zoho Books")
    load()
    setSyncing(false)
    setTimeout(() => setSyncMsg(""), 6000)
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: C.text }}>
      <Sidebar active="settings" />
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1000 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Settings</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>Data source, sync schedule, and per-module sync health</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Data Source</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginBottom: 8 }}>
              <Icon name="database" size={16} /> Zoho Books (via cached copy in Neon Postgres)
            </div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              Data is pulled from Zoho once and cached — the dashboard reads from that cache, never Zoho directly, to
              stay well clear of Zoho's API rate limits. A scheduled job refreshes the cache automatically every day
              at 2:00 AM IST (one batch of pages per module per run). Large modules may take a few days' worth of
              cron runs to fully catch up after a big change in Zoho; use "Sync Now" below to push progress
              immediately instead of waiting for the next cron run.
            </div>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Sync Status</div>
              <button onClick={syncNow} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.accent, color: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.6 : 1 }}>
                <Icon name="refresh" size={13} />{syncing ? "Syncing…" : "Sync Now"}
              </button>
            </div>
            {syncMsg && <div style={{ fontSize: 12, color: syncMsg.startsWith("Synced with") ? C.red : C.green, fontWeight: 600, marginBottom: 10 }}>{syncMsg}</div>}
            {loading && <div style={{ color: C.dim, fontSize: 13, padding: "12px 0" }}>Loading…</div>}
            {error && <div style={{ background: C.redDim, color: C.red, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>{error}</div>}
            {status && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.dim, textAlign: "left" as const }}>
                    <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Module</th>
                    <th style={{ padding: "4px 8px 8px", textAlign: "right" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Rows Cached</th>
                    <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Last Synced</th>
                    <th style={{ padding: "4px 8px 8px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {status.map(s => (
                    <tr key={s.module} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 8px", fontWeight: 600 }}>{MODULE_LABELS[s.module] ?? s.module}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right" as const }}>{s.row_count?.toLocaleString("en-IN") ?? "—"}</td>
                      <td style={{ padding: "9px 8px", color: C.dim }}>{s.synced_at ? new Date(s.synced_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</td>
                      <td style={{ padding: "9px 8px" }}>
                        {s.error
                          ? <span style={{ color: C.red, fontWeight: 600 }} title={s.error}>Error</span>
                          : <span style={{ color: C.green, fontWeight: 600 }}>OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Entity Mapping</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>
              Merge duplicate or inconsistent vendor/customer names (e.g. "Asvah" / "ASVAH" / "asvah") into one
              canonical name used across all payables/receivables views.
            </div>
            <a href="/dashboard/entities" style={{ fontSize: 12, color: C.blue, fontWeight: 600, textDecoration: "none" }}>Open Entity Master →</a>
          </div>
        </div>
      </main>
    </div>
  )
}
