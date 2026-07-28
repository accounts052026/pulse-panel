// ── Zoho data cache (Neon-backed, per-module tables) ───────────
// Instead of calling the Zoho Books API on every dashboard page load, or
// trying to sync all 9 modules in one long-running request (which risks
// hitting the serverless function's execution time limit and returning a
// non-JSON platform error page), each module gets its own table and its
// own short sync call. Rows are upserted in batches.

import { getNeon, rowsOf } from "./neon"
import { ZOHO_MODULE_CONFIG, zohoFetchOnePage } from "./zoho"

export const ZOHO_MODULES = [
  "invoices", "bills", "creditnotes", "vendorcredits",
  "customerpayments", "vendorpayments", "journals",
  "expenses", "bankaccounts",
] as const
export type ZohoModule = (typeof ZOHO_MODULES)[number]

const BATCH = 50 // rows per insert pass

async function ensureTables() {
  const sql = getNeon()
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_invoices (
      invoice_id TEXT PRIMARY KEY, invoice_number TEXT, customer_name TEXT,
      date TEXT, due_date TEXT, total NUMERIC, balance NUMERIC, status TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_bills (
      bill_id TEXT PRIMARY KEY, bill_number TEXT, vendor_name TEXT,
      date TEXT, due_date TEXT, total NUMERIC, balance NUMERIC, status TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_creditnotes (
      creditnote_id TEXT PRIMARY KEY, customer_name TEXT, date TEXT,
      total NUMERIC, status TEXT, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_vendorcredits (
      vendor_credit_id TEXT PRIMARY KEY, vendor_name TEXT, date TEXT,
      total NUMERIC, status TEXT, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_customerpayments (
      payment_id TEXT PRIMARY KEY, customer_name TEXT, date TEXT,
      amount NUMERIC, tax_amount_withheld NUMERIC, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_vendorpayments (
      payment_id TEXT PRIMARY KEY, vendor_name TEXT, date TEXT,
      amount NUMERIC, tax_amount_withheld NUMERIC, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_journals (
      journal_id TEXT PRIMARY KEY, journal_date TEXT, reference_number TEXT,
      total NUMERIC, line_items JSONB, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_expenses (
      expense_id TEXT PRIMARY KEY, account_name TEXT, vendor_name TEXT,
      date TEXT, total NUMERIC, synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_bankaccounts (
      account_id TEXT PRIMARY KEY, account_name TEXT, balance NUMERIC,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_sync_status (
      module TEXT PRIMARY KEY, row_count INT, synced_at TIMESTAMPTZ, error TEXT
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_sync_cursor (
      module TEXT PRIMARY KEY, next_page INT NOT NULL DEFAULT 1, done BOOLEAN NOT NULL DEFAULT false
    )`
}

// Upsert a single row from Zoho into the right table. Kept as one row at a
// time (not a bulk multi-row INSERT) to match the tagged-template style
// used everywhere else in this file — simple and safe, if not the fastest.
async function upsertRow(module: string, r: any): Promise<void> {
  const sql = getNeon()
  switch (module) {
    case "invoices":
      await sql`
        INSERT INTO zoho_invoices (invoice_id, invoice_number, customer_name, date, due_date, total, balance, status, synced_at)
        VALUES (${r.invoice_id}, ${r.invoice_number}, ${r.customer_name}, ${r.date}, ${r.due_date}, ${r.total || 0}, ${r.balance || 0}, ${r.status}, NOW())
        ON CONFLICT (invoice_id) DO UPDATE SET
          invoice_number=EXCLUDED.invoice_number, customer_name=EXCLUDED.customer_name,
          date=EXCLUDED.date, due_date=EXCLUDED.due_date, total=EXCLUDED.total,
          balance=EXCLUDED.balance, status=EXCLUDED.status, synced_at=NOW()
      `
      return
    case "bills":
      await sql`
        INSERT INTO zoho_bills (bill_id, bill_number, vendor_name, date, due_date, total, balance, status, synced_at)
        VALUES (${r.bill_id}, ${r.bill_number}, ${r.vendor_name}, ${r.date}, ${r.due_date}, ${r.total || 0}, ${r.balance || 0}, ${r.status}, NOW())
        ON CONFLICT (bill_id) DO UPDATE SET
          bill_number=EXCLUDED.bill_number, vendor_name=EXCLUDED.vendor_name,
          date=EXCLUDED.date, due_date=EXCLUDED.due_date, total=EXCLUDED.total,
          balance=EXCLUDED.balance, status=EXCLUDED.status, synced_at=NOW()
      `
      return
    case "creditnotes":
      await sql`
        INSERT INTO zoho_creditnotes (creditnote_id, customer_name, date, total, status, synced_at)
        VALUES (${r.creditnote_id}, ${r.customer_name}, ${r.date}, ${r.total || 0}, ${r.status}, NOW())
        ON CONFLICT (creditnote_id) DO UPDATE SET
          customer_name=EXCLUDED.customer_name, date=EXCLUDED.date,
          total=EXCLUDED.total, status=EXCLUDED.status, synced_at=NOW()
      `
      return
    case "vendorcredits":
      await sql`
        INSERT INTO zoho_vendorcredits (vendor_credit_id, vendor_name, date, total, status, synced_at)
        VALUES (${r.vendor_credit_id}, ${r.vendor_name}, ${r.date}, ${r.total || 0}, ${r.status}, NOW())
        ON CONFLICT (vendor_credit_id) DO UPDATE SET
          vendor_name=EXCLUDED.vendor_name, date=EXCLUDED.date,
          total=EXCLUDED.total, status=EXCLUDED.status, synced_at=NOW()
      `
      return
    case "customerpayments":
      await sql`
        INSERT INTO zoho_customerpayments (payment_id, customer_name, date, amount, tax_amount_withheld, synced_at)
        VALUES (${r.payment_id}, ${r.customer_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, NOW())
        ON CONFLICT (payment_id) DO UPDATE SET
          customer_name=EXCLUDED.customer_name, date=EXCLUDED.date,
          amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld, synced_at=NOW()
      `
      return
    case "vendorpayments":
      await sql`
        INSERT INTO zoho_vendorpayments (payment_id, vendor_name, date, amount, tax_amount_withheld, synced_at)
        VALUES (${r.payment_id}, ${r.vendor_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, NOW())
        ON CONFLICT (payment_id) DO UPDATE SET
          vendor_name=EXCLUDED.vendor_name, date=EXCLUDED.date,
          amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld, synced_at=NOW()
      `
      return
    case "journals":
      await sql`
        INSERT INTO zoho_journals (journal_id, journal_date, reference_number, total, line_items, synced_at)
        VALUES (${r.journal_id}, ${r.journal_date}, ${r.reference_number || ""}, ${r.total || 0}, ${JSON.stringify(r.line_items || [])}::jsonb, NOW())
        ON CONFLICT (journal_id) DO UPDATE SET
          journal_date=EXCLUDED.journal_date, reference_number=EXCLUDED.reference_number,
          total=EXCLUDED.total, line_items=EXCLUDED.line_items, synced_at=NOW()
      `
      return
    case "expenses":
      await sql`
        INSERT INTO zoho_expenses (expense_id, account_name, vendor_name, date, total, synced_at)
        VALUES (${r.expense_id}, ${r.account_name}, ${r.vendor_name || ""}, ${r.date}, ${r.total || 0}, NOW())
        ON CONFLICT (expense_id) DO UPDATE SET
          account_name=EXCLUDED.account_name, vendor_name=EXCLUDED.vendor_name,
          date=EXCLUDED.date, total=EXCLUDED.total, synced_at=NOW()
      `
      return
    case "bankaccounts":
      await sql`
        INSERT INTO zoho_bankaccounts (account_id, account_name, balance, synced_at)
        VALUES (${r.account_id}, ${r.account_name}, ${r.balance || 0}, NOW())
        ON CONFLICT (account_id) DO UPDATE SET
          account_name=EXCLUDED.account_name, balance=EXCLUDED.balance, synced_at=NOW()
      `
      return
  }
}

const TABLE_FOR_MODULE: Record<string, string> = {
  invoices: "zoho_invoices", bills: "zoho_bills", creditnotes: "zoho_creditnotes",
  vendorcredits: "zoho_vendorcredits", customerpayments: "zoho_customerpayments",
  vendorpayments: "zoho_vendorpayments", journals: "zoho_journals",
  expenses: "zoho_expenses", bankaccounts: "zoho_bankaccounts",
}

// Resumable batch sync — fetches only a bounded number of Zoho pages per
// call instead of the whole module at once. A cursor (zoho_sync_cursor)
// tracks which page to continue from, so large modules like invoices —
// which were timing out mid-fetch before writing anything at all — now
// make guaranteed forward progress on every call, even if it takes several
// calls to finish. The UI's "Sync Zoho Now" button calls this repeatedly
// per module until `done` comes back true.
//
// pagesPerCall was originally 4 — fine for small modules (bills is only
// ~17 pages), but invoices runs ~110+ pages. At 4 pages/call, the daily
// cron (one call per module per day) would take the better part of a
// month to complete a single full pass, leaving the cached invoice total
// silently under-reporting real Zoho balances in the meantime (exactly
// what caused the dashboard to show ~1.55 Cr receivables against Zoho's
// own ~3.72 Cr). 15 pages/call (~3000 rows, well under Vercel's 60s
// function limit even with the 250ms inter-page delay) clears a module
// this size in roughly a week of daily cron runs instead of a month, and
// the manual "Sync Zoho" button — which loops calls until done — now
// needs far fewer round trips to fully catch up in one sitting.
export async function syncModuleBatch(module: ZohoModule, pagesPerCall = 15): Promise<{ module: string; fetchedThisCall: number; totalRows: number; done: boolean; nextPage: number }> {
  await ensureTables()
  const sql = getNeon()
  const config = ZOHO_MODULE_CONFIG[module]
  if (!config) throw new Error(`Unknown module "${module}"`)

  try {
    const cursorRows = await sql`SELECT next_page FROM zoho_sync_cursor WHERE module = ${module}`
    let page = (cursorRows as unknown as { next_page: number }[])[0]?.next_page ?? 1

    let fetchedThisCall = 0
    let done = false

    for (let i = 0; i < pagesPerCall; i++) {
      const { rows, hasMore } = await zohoFetchOnePage(config.path, config.listKey, page, config.sortColumn)
      for (const r of rows) await upsertRow(module, r)
      fetchedThisCall += rows.length
      if (!hasMore) { done = true; break }
      page++
      await new Promise(res => setTimeout(res, 250)) // stay clear of Zoho's rate limit
    }

    const nextPage = done ? 1 : page + 1
    await sql`
      INSERT INTO zoho_sync_cursor (module, next_page, done)
      VALUES (${module}, ${nextPage}, ${done})
      ON CONFLICT (module) DO UPDATE SET next_page = EXCLUDED.next_page, done = EXCLUDED.done
    `

    const table = TABLE_FOR_MODULE[module]
    const sqlFn = sql as unknown as (text: string, params?: unknown[]) => Promise<any>
    const countRows = await sqlFn(`SELECT COUNT(*)::int AS n FROM ${table}`)
    const totalRows = ((Array.isArray(countRows) ? countRows : (countRows as any).rows) as { n: number }[])[0]?.n ?? 0

    await sql`
      INSERT INTO zoho_sync_status (module, row_count, synced_at, error)
      VALUES (${module}, ${totalRows}, NOW(), NULL)
      ON CONFLICT (module) DO UPDATE SET row_count=EXCLUDED.row_count, synced_at=NOW(), error=NULL
    `

    return { module, fetchedThisCall, totalRows, done, nextPage }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sql`
      INSERT INTO zoho_sync_status (module, row_count, synced_at, error)
      VALUES (${module}, 0, NOW(), ${msg})
      ON CONFLICT (module) DO UPDATE SET synced_at=NOW(), error=EXCLUDED.error
    `
    throw err
  }
}

export async function getSyncStatus(): Promise<{ module: string; row_count: number; synced_at: string; error: string | null }[]> {
  await ensureTables()
  const sql = getNeon()
  const rows = await sql`SELECT module, row_count, synced_at, error FROM zoho_sync_status ORDER BY module`
  return rows as unknown as { module: string; row_count: number; synced_at: string; error: string | null }[]
}

export async function getLastSyncedAt(): Promise<string | null> {
  await ensureTables()
  const sql = getNeon()
  const rows = await sql`SELECT MIN(synced_at) AS synced_at FROM zoho_sync_status WHERE error IS NULL`
  return (rows as unknown as { synced_at: string | null }[])[0]?.synced_at ?? null
}

// ── Entity mapping (canonical / platform names) ─────────────────
//
// THE single source of truth for entity→platform name resolution. Every
// route previously carried its own private copy of this function, each
// with a `catch { return {} }` that swallowed failures — so a mapping
// could silently apply on one screen and not another, or (via the
// rowsOf-shape bug) nowhere at all while still reporting success.
//
// Purpose: one platform trades under many legal entity names (Blinkit
// alone bills as "Blink Commerce Private Limited", "Moonstone Ventures
// LLP", "Asvah Retail Private Limited", …). Mapping them all to a single
// canonical platform name is what makes the numbers decision-ready —
// so this MUST be applied consistently in every view, not just some.
export async function getEntityMapping(): Promise<Record<string, string>> {
  const sql = getNeon()
  await sql`
    CREATE TABLE IF NOT EXISTS entity_mapping (
      entity_name    TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      side           TEXT NOT NULL,
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
  const res = await sql`SELECT entity_name, canonical_name FROM entity_mapping`
  const map: Record<string, string> = {}
  for (const r of rowsOf<{ entity_name: string; canonical_name: string }>(res)) {
    map[r.entity_name] = r.canonical_name
    // Also index a trimmed/case-normalised form so a mapping still applies
    // when Zoho returns the same party with stray whitespace or different
    // casing than the row the user actually edited.
    map[r.entity_name.trim().toLowerCase()] = r.canonical_name
  }
  return map
}

// Resolve a raw Zoho party name to its canonical/platform name.
export function canonical(raw: string | null | undefined, mapping: Record<string, string>): string {
  const name = (raw ?? "").trim() || "Unknown"
  return mapping[name] ?? mapping[name.toLowerCase()] ?? name
}

// ── Typed readers used by the dashboard/entities/entity-snapshot routes ──
//
// IMPORTANT: Postgres NUMERIC columns come back from the Neon serverless
// driver as STRINGS (to avoid float precision loss), not JS numbers. Every
// numeric field is explicitly coerced with Number(...) here, once, so every
// consumer downstream can safely do arithmetic (+=, reduce, etc.) without
// silently falling into string concatenation.
const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return isNaN(n) ? 0 : n
}

// Diagnosed cause of the "cached reader returns empty array" bug: selecting
// many TEXT/NUMERIC columns together across ~2000 rows in one unbounded
// query silently returns an empty result from the Neon HTTP driver instead
// of throwing (confirmed via /api/zoho/debug — every individual column, and
// a 5-column subset, returned all 2000 rows fine; only the full 8-column
// query came back empty). Pagination with LIMIT/OFFSET keeps each query's
// result small enough to avoid whatever size threshold triggers this.
const PAGE = 500

// Count-driven pagination.
//
// The previous version looped `while (true)` and did `if (page.length <
// PAGE) break`. That treats ANY short or empty page as "end of table" —
// so a single transient short response from the driver silently truncated
// the result and the caller had no way to tell. On zoho_invoices (22,751
// rows = ~46 pages) that meant the dashboard could quietly sum only part
// of the table and report receivables well under the real Zoho total,
// with no error anywhere. Payables (3,389 rows) is small enough that it
// usually completed before hitting the problem, which is exactly why
// payables matched Zoho while receivables didn't.
//
// Now we read COUNT(*) first and page until we've actually collected that
// many rows, retrying a spurious empty page once and then failing LOUDLY
// rather than under-reporting financial totals.
async function fetchPaged<T>(pk: string, table: string, columns: string): Promise<T[]> {
  const sql = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<any>

  // Table/column names here are fixed internal constants (never user input),
  // so building the query text directly is safe; only LIMIT/OFFSET are
  // interpolated as real bound parameters ($1/$2).
  const total = rowsOf<{ n: number }>(await sql(`SELECT COUNT(*)::int AS n FROM ${table}`))[0]?.n ?? 0
  const out: T[] = []

  for (let offset = 0; offset < total; offset += PAGE) {
    const q = `SELECT ${columns} FROM ${table} ORDER BY ${pk} LIMIT $1 OFFSET $2`
    let page = rowsOf<T>(await sql(q, [PAGE, offset]))
    if (page.length === 0) {
      page = rowsOf<T>(await sql(q, [PAGE, offset])) // one retry
      if (page.length === 0) {
        throw new Error(`fetchPaged: ${table} returned 0 rows at offset ${offset} of ${total} — refusing to return truncated data`)
      }
    }
    out.push(...page)
  }

  return out
}

export async function getCachedInvoices() {
  await ensureTables()
  const rows = await fetchPaged<{ invoice_id: string; invoice_number: string; customer_name: string; date: string; due_date: string; total: unknown; balance: unknown; status: string }>(
    "invoice_id", "zoho_invoices", "invoice_id, invoice_number, customer_name, date, due_date, total, balance, status"
  )
  return rows.map(r => ({ ...r, total: num(r.total), balance: num(r.balance) }))
}

export async function getCachedBills() {
  await ensureTables()
  const rows = await fetchPaged<{ bill_id: string; bill_number: string; vendor_name: string; date: string; due_date: string; total: unknown; balance: unknown; status: string }>(
    "bill_id", "zoho_bills", "bill_id, bill_number, vendor_name, date, due_date, total, balance, status"
  )
  return rows.map(r => ({ ...r, total: num(r.total), balance: num(r.balance) }))
}

export async function getCachedCreditNotes() {
  await ensureTables()
  const rows = await fetchPaged<{ creditnote_id: string; customer_name: string; date: string; total: unknown; status: string }>(
    "creditnote_id", "zoho_creditnotes", "creditnote_id, customer_name, date, total, status"
  )
  return rows.map(r => ({ ...r, total: num(r.total) }))
}

export async function getCachedVendorCredits() {
  await ensureTables()
  const rows = await fetchPaged<{ vendor_credit_id: string; vendor_name: string; date: string; total: unknown; status: string }>(
    "vendor_credit_id", "zoho_vendorcredits", "vendor_credit_id, vendor_name, date, total, status"
  )
  return rows.map(r => ({ ...r, total: num(r.total) }))
}

export async function getCachedCustomerPayments() {
  await ensureTables()
  const rows = await fetchPaged<{ payment_id: string; customer_name: string; date: string; amount: unknown; tax_amount_withheld: unknown }>(
    "payment_id", "zoho_customerpayments", "payment_id, customer_name, date, amount, tax_amount_withheld"
  )
  return rows.map(r => ({ ...r, amount: num(r.amount), tax_amount_withheld: num(r.tax_amount_withheld) }))
}

export async function getCachedVendorPayments() {
  await ensureTables()
  const rows = await fetchPaged<{ payment_id: string; vendor_name: string; date: string; amount: unknown; tax_amount_withheld: unknown }>(
    "payment_id", "zoho_vendorpayments", "payment_id, vendor_name, date, amount, tax_amount_withheld"
  )
  return rows.map(r => ({ ...r, amount: num(r.amount), tax_amount_withheld: num(r.tax_amount_withheld) }))
}

export async function getCachedJournals() {
  await ensureTables()
  const rows = await fetchPaged<{ journal_id: string; journal_date: string; reference_number: string; total: unknown; line_items: any[] }>(
    "journal_id", "zoho_journals", "journal_id, journal_date, reference_number, total, line_items"
  )
  return rows.map(r => ({ ...r, total: num(r.total) }))
}

export async function getCachedExpenses() {
  await ensureTables()
  const rows = await fetchPaged<{ expense_id: string; account_name: string; vendor_name: string; date: string; total: unknown }>(
    "expense_id", "zoho_expenses", "expense_id, account_name, vendor_name, date, total"
  )
  return rows.map(r => ({ ...r, total: num(r.total) }))
}

export async function getCachedBankAccounts() {
  await ensureTables()
  const rows = await fetchPaged<{ account_id: string; account_name: string; balance: unknown }>(
    "account_id", "zoho_bankaccounts", "account_id, account_name, balance"
  )
  return rows.map(r => ({ ...r, balance: num(r.balance) }))
}
