import { neon } from "@neondatabase/serverless"

// ── Neon client (analytics layer) ────────────────────────────
// Usage: const sql = getNeon()
//        const rows = await sql`SELECT ...`

let _sql: ReturnType<typeof neon> | null = null

export function getNeon() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL env var missing")
    _sql = neon(url)
  }
  return _sql
}

// ── Result-shape normaliser ──────────────────────────────────────
// The Neon serverless driver returns EITHER a bare array of row objects
// OR a FullQueryResults object with a `.rows` property, depending on the
// call form and driver version. Code that assumed "always an array" broke
// in two nasty ways:
//   - `for (const r of rows)` throws "not iterable" on the object form.
//     Where that sat inside a try/catch returning {} on failure (as the
//     entity_mapping readers did), the mapping silently came back EMPTY —
//     which is why saved mappings never appeared anywhere in the UI even
//     though the rows were sitting in the table.
//   - `.map()` / `.length` silently misbehave on the object form.
// Every read should go through this instead of casting.
export function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && typeof res === "object" && Array.isArray((res as { rows?: unknown }).rows)) {
    return (res as { rows: T[] }).rows
  }
  return []
}

// ── Types ─────────────────────────────────────────────────────

export interface MonthlyPlatformSummary {
  month:           string   // "2026-04"
  platform:        string
  type:            string
  invoiced:        number
  credit_notes:    number
  cash_in:         number
  bills:           number
  vendor_credits:  number
  cash_out:        number
  cgst:            number
  sgst:            number
  igst:            number
  cess:            number
  tds:             number
  net_ar:          number
  net_ap:          number
  gross_margin:    number
  row_count:       number
}

export interface ReconciliationRow {
  invoice_no:      string
  platform:        string
  invoice_date:    string
  invoiced_amount: number
  platform_net:    number | null
  variance:        number | null
  status:          "matched" | "short_paid" | "over_paid" | "pending"
}

export interface PlatformKPI {
  platform:        string
  total_invoiced:  number
  total_received:  number
  total_bills:     number
  total_paid:      number
  gross_margin:    number
  margin_pct:      number
  outstanding_ar:  number
  outstanding_ap:  number
}
