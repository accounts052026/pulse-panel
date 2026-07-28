// ── Zoho data cache (Neon-backed) ──────────────────────────────
// Instead of calling the Zoho Books API on every dashboard page load
// (which burns API credits fast and hits Zoho's rate limit), we pull
// everything once via /api/zoho/sync and stash it here. All dashboard
// routes read from this cache; only the sync route talks to Zoho.

import { getNeon } from "./neon"
import {
  getInvoices, getBills, getCreditNotes, getVendorCredits,
  getCustomerPayments, getVendorPayments, getJournals,
  getExpenses, getBankAccounts,
} from "./zoho"

const MODULES = [
  "invoices", "bills", "creditnotes", "vendorcredits",
  "customerpayments", "vendorpayments", "journals",
  "expenses", "bankaccounts",
] as const
export type ZohoModule = (typeof MODULES)[number]

async function ensureTable() {
  const sql = getNeon()
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_cache (
      module     TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

// Pull everything from Zoho and overwrite the cache. This is the ONLY
// function in the app that should call the live Zoho API for these modules.
export async function syncAllFromZoho(): Promise<{ module: string; count: number }[]> {
  await ensureTable()
  const sql = getNeon()

  const fetchers: [ZohoModule, () => Promise<any[]>][] = [
    ["invoices", getInvoices],
    ["bills", getBills],
    ["creditnotes", getCreditNotes],
    ["vendorcredits", getVendorCredits],
    ["customerpayments", getCustomerPayments],
    ["vendorpayments", getVendorPayments],
    ["journals", getJournals],
    ["expenses", getExpenses],
    ["bankaccounts", getBankAccounts],
  ]

  const results: { module: string; count: number }[] = []

  // Sequential, not parallel — Zoho rate-limits aggressively; hitting all
  // 9 endpoints at once is exactly what triggered "too many requests".
  for (const [name, fn] of fetchers) {
    const data = await fn()
    await sql`
      INSERT INTO zoho_cache (module, data, synced_at)
      VALUES (${name}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (module) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()
    `
    results.push({ module: name, count: data.length })
    // small delay between modules to stay well under Zoho's per-minute cap
    await new Promise(r => setTimeout(r, 1200))
  }

  return results
}

export async function getSyncStatus(): Promise<{ module: string; count: number; synced_at: string }[]> {
  await ensureTable()
  const sql = getNeon()
  const rows = await sql`SELECT module, jsonb_array_length(data) AS count, synced_at FROM zoho_cache ORDER BY module`
  return rows as unknown as { module: string; count: number; synced_at: string }[]
}

export async function getCachedModule<T = any>(module: ZohoModule): Promise<T[]> {
  await ensureTable()
  const sql = getNeon()
  const rows = await sql`SELECT data FROM zoho_cache WHERE module = ${module}`
  const row = (rows as unknown as { data: T[] }[])[0]
  return row?.data ?? []
}

export async function getLastSyncedAt(): Promise<string | null> {
  await ensureTable()
  const sql = getNeon()
  const rows = await sql`SELECT MIN(synced_at) AS synced_at FROM zoho_cache`
  return (rows as unknown as { synced_at: string | null }[])[0]?.synced_at ?? null
}
