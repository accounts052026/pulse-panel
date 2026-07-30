// ── Zoho data cache (Neon-backed, per-module tables) ───────────
// Instead of calling the Zoho Books API on every dashboard page load, or
// trying to sync all 9 modules in one long-running request (which risks
// hitting the serverless function's execution time limit and returning a
// non-JSON platform error page), each module gets its own table and its
// own short sync call. Rows are upserted in batches.

import { getNeon, rowsOf } from "./neon"
import { ZOHO_MODULE_CONFIG, zohoFetchOnePage, zohoFetchDetail } from "./zoho"

export const ZOHO_MODULES = [
  "invoices", "bills", "creditnotes", "vendorcredits",
  "customerpayments", "vendorpayments", "journals",
  "expenses", "bankaccounts", "contacts",
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
  // Zoho's own closing balance per party, including opening balances and
  // unapplied credits — the same figures behind the Vendor/Customer Balance
  // Summary reports.
  await sql`
    CREATE TABLE IF NOT EXISTS zoho_contacts (
      contact_id TEXT PRIMARY KEY, contact_name TEXT, contact_type TEXT,
      outstanding_receivable NUMERIC DEFAULT 0, outstanding_payable NUMERIC DEFAULT 0,
      unused_credits_receivable NUMERIC DEFAULT 0, unused_credits_payable NUMERIC DEFAULT 0,
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

  // Unapplied advance amounts. Zoho exposes these as `unused_amount` on a
  // payment — money received from a customer (unearned revenue) or paid to
  // a vendor (prepaid expense) that hasn't been matched to any document.
  // Added separately so existing installs pick them up without a rebuild;
  // they stay 0 until the next sync repopulates the payment tables.
  await sql`ALTER TABLE zoho_customerpayments ADD COLUMN IF NOT EXISTS unused_amount NUMERIC DEFAULT 0`
  await sql`ALTER TABLE zoho_vendorpayments   ADD COLUMN IF NOT EXISTS unused_amount NUMERIC DEFAULT 0`
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
        INSERT INTO zoho_customerpayments (payment_id, customer_name, date, amount, tax_amount_withheld, unused_amount, synced_at)
        VALUES (${r.payment_id}, ${r.customer_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, ${r.unused_amount || 0}, NOW())
        ON CONFLICT (payment_id) DO UPDATE SET
          customer_name=EXCLUDED.customer_name, date=EXCLUDED.date,
          amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld,
          unused_amount=EXCLUDED.unused_amount, synced_at=NOW()
      `
      return
    case "vendorpayments":
      await sql`
        INSERT INTO zoho_vendorpayments (payment_id, vendor_name, date, amount, tax_amount_withheld, unused_amount, synced_at)
        VALUES (${r.payment_id}, ${r.vendor_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, ${r.unused_amount || 0}, NOW())
        ON CONFLICT (payment_id) DO UPDATE SET
          vendor_name=EXCLUDED.vendor_name, date=EXCLUDED.date,
          amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld,
          unused_amount=EXCLUDED.unused_amount, synced_at=NOW()
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
    case "contacts":
      await sql`
        INSERT INTO zoho_contacts (contact_id, contact_name, contact_type,
          outstanding_receivable, outstanding_payable,
          unused_credits_receivable, unused_credits_payable, synced_at)
        VALUES (${r.contact_id}, ${r.contact_name}, ${r.contact_type || ""},
          ${r.outstanding_receivable_amount || 0}, ${r.outstanding_payable_amount || 0},
          ${r.unused_credits_receivable_amount || 0}, ${r.unused_credits_payable_amount || 0}, NOW())
        ON CONFLICT (contact_id) DO UPDATE SET
          contact_name=EXCLUDED.contact_name, contact_type=EXCLUDED.contact_type,
          outstanding_receivable=EXCLUDED.outstanding_receivable,
          outstanding_payable=EXCLUDED.outstanding_payable,
          unused_credits_receivable=EXCLUDED.unused_credits_receivable,
          unused_credits_payable=EXCLUDED.unused_credits_payable, synced_at=NOW()
      `
      return
  }
}

const TABLE_FOR_MODULE: Record<string, string> = {
  invoices: "zoho_invoices", bills: "zoho_bills", creditnotes: "zoho_creditnotes",
  vendorcredits: "zoho_vendorcredits", customerpayments: "zoho_customerpayments",
  vendorpayments: "zoho_vendorpayments", journals: "zoho_journals",
  expenses: "zoho_expenses", bankaccounts: "zoho_bankaccounts",
  contacts: "zoho_contacts",
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
export async function ensureEntityMappingTable(): Promise<void> {
  const sql = getNeon()
  await sql`
    CREATE TABLE IF NOT EXISTS entity_mapping (
      entity_name    TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      side           TEXT NOT NULL,
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Expense category is a later addition — added separately so existing
  // installs pick it up without losing their saved mappings.
  await sql`ALTER TABLE entity_mapping ADD COLUMN IF NOT EXISTS category TEXT`
}

export async function readEntityMappingRows(): Promise<{ entity_name: string; canonical_name: string; category: string | null }[]> {
  const sqlT = getNeon()
  const sqlF = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>

  await ensureEntityMappingTable()

  type Row = { entity_name: string; canonical_name: string; category: string | null }

  // Read the whole table as a SINGLE aggregated JSON value.
  //
  // Why not a plain `SELECT entity_name, canonical_name FROM entity_mapping`?
  // Because on this stack that query returns an EMPTY array while, in the
  // very same request, `SELECT COUNT(*) FROM entity_mapping` correctly
  // returns 3 (confirmed via /api/debug/mapping). Both driver call forms
  // behave identically, so it isn't the tagged-template vs function-call
  // distinction — row-returning multi-column selects are what break. This
  // is the same unexplained behaviour that forced the Zoho readers onto
  // paginated reads earlier in this project.
  //
  // Aggregates demonstrably DO work, so we ask Postgres to fold every row
  // into one json_agg value and decode it here. One row, one column — the
  // shape that is known to survive — and the mapping is small enough that
  // returning it in a single value is cheap.
  const AGG_QUERY = `
    SELECT COALESCE(
      json_agg(json_build_object(
        'entity_name', entity_name,
        'canonical_name', canonical_name,
        'category', category
      )),
      '[]'::json
    ) AS data
    FROM entity_mapping
  `

  const decode = (res: unknown): Row[] => {
    const raw = rowsOf<{ data: unknown }>(res)[0]?.data
    if (!raw) return []
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? (arr as Row[]) : []
  }

  let rows = decode(await sqlF(AGG_QUERY))

  // Last-ditch fallback to the plain select, in case a future driver/runtime
  // fixes the underlying issue and the aggregate path ever regresses.
  if (rows.length === 0) {
    rows = rowsOf<Row>(await sqlT`SELECT entity_name, canonical_name, category FROM entity_mapping`)
  }

  return rows.filter(r => r && typeof r.entity_name === "string" && typeof r.canonical_name === "string")
}

export async function getEntityMapping(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  for (const r of await readEntityMappingRows()) {
    map[r.entity_name] = r.canonical_name
    // Also index a trimmed/case-normalised form so a mapping still applies
    // when Zoho returns the same party with stray whitespace or different
    // casing than the row the user actually edited.
    map[r.entity_name.trim().toLowerCase()] = r.canonical_name
  }
  return map
}

// Manually-assigned expense category per raw entity name.
export async function getEntityCategoryMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  for (const r of await readEntityMappingRows()) {
    if (r.category) {
      map[r.entity_name] = r.category
      map[r.entity_name.trim().toLowerCase()] = r.category
    }
  }
  return map
}

// Expense category inferred from actual Zoho data: for each vendor, the
// expense account they've been booked against the most (by value). Zoho
// bills carry no category, so zoho_expenses.account_name is the only real
// signal available — this gives every vendor that appears in an expense a
// sensible category with no manual work, and anything it can't infer can
// be set by hand in Entity Master.
export async function getDerivedVendorCategories(): Promise<Record<string, string>> {
  const sql = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>

  const res = await sql(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
      SELECT
        TRIM(vendor_name) AS entity_name,
        COALESCE(NULLIF(TRIM(account_name), ''), 'Uncategorised') AS category,
        COALESCE(SUM(total), 0)::float8 AS amt
      FROM zoho_expenses
      WHERE vendor_name IS NOT NULL AND TRIM(vendor_name) <> ''
      GROUP BY 1, 2
    ) t
  `)

  const raw = rowsOf<{ data: unknown }>(res)[0]?.data
  if (!raw) return {}
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw
  if (!Array.isArray(arr)) return {}

  // Keep the highest-value category per vendor.
  const best: Record<string, { category: string; amt: number }> = {}
  for (const row of arr as { entity_name: string; category: string; amt: number }[]) {
    const key = row.entity_name
    const amt = num(row.amt)
    if (!best[key] || amt > best[key].amt) best[key] = { category: row.category, amt }
  }

  const out: Record<string, string> = {}
  for (const [name, v] of Object.entries(best)) {
    out[name] = v.category
    out[name.trim().toLowerCase()] = v.category
  }
  return out
}

// Resolve a raw Zoho party name to its canonical/platform name.
export function canonical(raw: string | null | undefined, mapping: Record<string, string>): string {
  const name = (raw ?? "").trim() || "Unknown"
  return mapping[name] ?? mapping[name.toLowerCase()] ?? name
}

// ── Credit note line-account enrichment ─────────────────────────
//
// Zoho's /creditnotes LIST endpoint returns headers only — no line items —
// so from the list alone a BDPO/post-sales-discount credit note and an
// undelivered/returns credit note are indistinguishable. The account each
// line posts to is the distinguishing signal, and that only comes from the
// per-credit-note detail endpoint.
//
// Fetching ~1,700 details in one request would blow both the serverless
// time limit and Zoho's rate limit, so this mirrors the resumable pattern
// used for the main sync: enrich a bounded number of un-enriched rows per
// call and record progress, so repeated calls converge.
export async function ensureCreditNoteDetailColumns(): Promise<void> {
  const sql = getNeon()
  await sql`ALTER TABLE zoho_creditnotes ADD COLUMN IF NOT EXISTS line_accounts TEXT`
  await sql`ALTER TABLE zoho_creditnotes ADD COLUMN IF NOT EXISTS detail_synced_at TIMESTAMPTZ`
}

export async function syncCreditNoteDetailsBatch(limit = 40): Promise<{ processed: number; remaining: number }> {
  await ensureTables()
  await ensureCreditNoteDetailColumns()
  const sql = getNeon()
  const sqlF = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>

  const pending = rowsOf<{ creditnote_id: string }>(
    await sqlF(
      `SELECT creditnote_id FROM zoho_creditnotes WHERE detail_synced_at IS NULL ORDER BY creditnote_id LIMIT $1`,
      [limit]
    )
  )

  let processed = 0
  for (const row of pending) {
    try {
      const data = await zohoFetchDetail(`/creditnotes/${row.creditnote_id}`)
      const items = data?.creditnote?.line_items ?? []
      const accounts = Array.from(
        new Set(
          (items as { account_name?: string; description?: string }[])
            .map(li => (li.account_name || "").trim())
            .filter(Boolean)
        )
      )
      await sql`
        UPDATE zoho_creditnotes
        SET line_accounts = ${JSON.stringify(accounts)}, detail_synced_at = NOW()
        WHERE creditnote_id = ${row.creditnote_id}
      `
      processed++
      await new Promise(res => setTimeout(res, 200)) // stay clear of Zoho's rate limit
    } catch {
      // Mark as attempted with an empty account list so one bad record can't
      // permanently stall the queue; it simply classifies as "Other".
      await sql`
        UPDATE zoho_creditnotes
        SET line_accounts = COALESCE(line_accounts, '[]'), detail_synced_at = NOW()
        WHERE creditnote_id = ${row.creditnote_id}
      `
      processed++
    }
  }

  const remaining = rowsOf<{ n: number }>(
    await sqlF(`SELECT COUNT(*)::int AS n FROM zoho_creditnotes WHERE detail_synced_at IS NULL`)
  )[0]?.n ?? 0

  return { processed, remaining }
}

// Classify a credit note from the accounts its lines post to.
// Keyword defaults cover the usual Zoho chart-of-accounts naming; anything
// unrecognised falls to "other" rather than being silently lumped into a
// bucket it doesn't belong in.
export type CreditNoteKind = "bdpo" | "returns" | "other"

export function classifyCreditNote(accounts: string[]): CreditNoteKind {
  const text = accounts.join(" ").toLowerCase()
  if (!text) return "other"
  if (/bdpo|brand discount|promo|discount|scheme|rebate/.test(text)) return "bdpo"
  if (/return|undeliver|damage|short|expiry|expired|rejec/.test(text)) return "returns"
  return "other"
}

// ── Net ageing / outstanding — THE single calculation ───────────
//
// Dashboard, Payables, Receivables, Ageing and Platforms must all report
// the same outstanding figure. They previously each did their own version
// and drifted badly (the dashboard read 1.84 Cr while the same data showed
// 3.36 Cr on the Receivables and Ageing pages), so every view now derives
// its numbers from this one function.
//
// Two rules encoded here:
//  1. Outstanding balance is a point-in-time snapshot. It is NOT filtered
//     by document date — an unpaid invoice from a previous financial year
//     is still receivable today. Date filters belong on flows (expenses,
//     trends, settlement), never on a balance.
//  2. Advances are applied PER ENTITY, capped at that entity's own
//     balance. Applying a pooled total across all entities would let one
//     party's excess advance wrongly reduce another party's debt.
export const AGEING_BUCKETS = ["0 - 30 Days", "31 - 60 Days", "61 - 90 Days", "91 - 120 Days", "> 120 Days"] as const
export type AgeingBucketLabel = (typeof AGEING_BUCKETS)[number]

function bucketForDays(days: number): AgeingBucketLabel {
  if (days <= 30) return "0 - 30 Days"
  if (days <= 60) return "31 - 60 Days"
  if (days <= 90) return "61 - 90 Days"
  if (days <= 120) return "91 - 120 Days"
  return "> 120 Days"
}

export interface NetAgeingEntity {
  name: string
  buckets: Record<string, number>
  grossBuckets: Record<string, number>
  total: number
  grossTotal: number
  overdue: number
  grossOverdue: number
  advance: number
  unabsorbedAdvance: number
  count: number
}

export interface NetAgeingResult {
  entities: NetAgeingEntity[]
  bucketTotals: { label: string; amount: number }[]
  total: number
  grossTotal: number
  overdue: number
  grossOverdue: number
  advance: number
}

export function computeNetAgeing(
  items: { balance: number; due_date: string; date?: string; status?: string }[],
  nameKey: string,
  mapping: Record<string, string>,
  unapplied: Record<string, number>,
  // "As on" date. A balance is a point-in-time figure, so a period filter
  // has to mean "show the position as at this date" rather than "only count
  // documents dated inside the period" — an invoice raised last year and
  // still unpaid is part of today's balance. Documents dated after this are
  // excluded, and ageing is measured from it.
  asOn: Date = new Date(),
): NetAgeingResult {
  const today = asOn
  const emptyBuckets = () => Object.fromEntries(AGEING_BUCKETS.map(b => [b, 0])) as Record<string, number>

  const gross: Record<string, { buckets: Record<string, number>; overdue: number; count: number }> = {}

  const asOnIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  for (const it of items) {
    const bal = it.balance || 0
    if (!bal) continue
    // A document raised after the as-on date isn't part of that date's
    // position.
    if (it.date && it.date.slice(0, 10) > asOnIso) continue
    const name = canonical((it as Record<string, unknown>)[nameKey] as string, mapping)
    if (!gross[name]) gross[name] = { buckets: emptyBuckets(), overdue: 0, count: 0 }

    const due = new Date(it.due_date)
    const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
    gross[name].buckets[bucketForDays(days)] += bal
    gross[name].count += 1
    if (days > 0) gross[name].overdue += bal
  }

  // Advances roll up to the same canonical grouping before being applied.
  const advanceFor: Record<string, number> = {}
  for (const [rawName, amt] of Object.entries(unapplied)) {
    const name = canonical(rawName, mapping)
    advanceFor[name] = (advanceFor[name] ?? 0) + amt
  }
  for (const name of Object.keys(advanceFor)) {
    if (!gross[name]) gross[name] = { buckets: emptyBuckets(), overdue: 0, count: 0 }
  }

  const entities: NetAgeingEntity[] = Object.entries(gross).map(([name, g]) => {
    const grossTotal = Object.values(g.buckets).reduce((s, v) => s + v, 0)
    const advance = advanceFor[name] ?? 0

    // FIFO — oldest bucket first, since the oldest document settles first.
    const net = { ...g.buckets }
    let left = advance
    for (let i = AGEING_BUCKETS.length - 1; i >= 0 && left > 0; i--) {
      const b = AGEING_BUCKETS[i]
      const applied = Math.min(net[b], left)
      net[b] -= applied
      left -= applied
    }

    return {
      name,
      buckets: net,
      grossBuckets: g.buckets,
      total: grossTotal - (advance - left), // only what was actually absorbed
      grossTotal,
      overdue: Math.max(0, g.overdue - advance),
      grossOverdue: g.overdue,
      advance,
      unabsorbedAdvance: left,
      count: g.count,
    }
  })
    .filter(e => e.grossTotal !== 0 || e.advance !== 0)
    .sort((a, b) => b.total - a.total)

  const bucketTotals = AGEING_BUCKETS.map(label => ({
    label,
    amount: entities.reduce((s, e) => s + e.buckets[label], 0),
  }))

  return {
    entities,
    bucketTotals,
    total: entities.reduce((s, e) => s + e.total, 0),
    grossTotal: entities.reduce((s, e) => s + e.grossTotal, 0),
    overdue: entities.reduce((s, e) => s + e.overdue, 0),
    grossOverdue: entities.reduce((s, e) => s + e.grossOverdue, 0),
    advance: entities.reduce((s, e) => s + (e.advance - e.unabsorbedAdvance), 0),
  }
}

// ── Net position per entity — THE figure every page reports ─────
//
// "What do I owe / what am I owed" — one number, already net of credits,
// advances and opening balances. Zoho's contact record carries exactly
// that (it's what its Vendor/Customer Balance Summary prints), and it
// cannot be reconstructed by summing unpaid documents: opening balances
// have no document behind them, and Dr balances from overpayment offset
// the total. Summing documents read ~1.50 Cr against Zoho's 1.04 Cr.
//
// Ageing buckets still have to come from documents (a balance with no
// invoice behind it has no due date), so the gap between Zoho's net and
// the document total is placed in the oldest bucket — opening balances
// are by definition old — and the buckets are then made to sum to the
// authoritative net so every page ties.
export interface NetPosition {
  name: string
  outstanding: number
  overdue: number
  count: number
  buckets: Record<string, number>
}

export interface NetPositionResult {
  entities: NetPosition[]
  total: number
  overdue: number
  bucketTotals: { label: string; amount: number }[]
  source: "zoho-contacts" | "documents"
}

export async function getNetPositions(
  side: "payable" | "receivable",
  mapping: Record<string, string>,
  docs: { balance: number; due_date: string; date?: string; status?: string }[],
  nameKey: string,
  asOn: Date = new Date(),
): Promise<NetPositionResult> {
  const isHistorical = asOn < new Date(new Date().toDateString())

  // Raw document ageing (no advance netting — credits come from contacts).
  const docAgeing = computeNetAgeing(docs, nameKey, mapping, {}, asOn)

  const contacts = isHistorical ? [] : await getContactBalances(side)

  // Contact balances are a CURRENT snapshot with no history, so for a past
  // as-on date we fall back to documents netted by unapplied payments.
  if (contacts.length === 0) {
    const unapplied = await getUnappliedByEntity(side)
    const netted = computeNetAgeing(docs, nameKey, mapping, unapplied, asOn)
    return {
      entities: netted.entities.map(e => ({
        name: e.name, outstanding: e.total, overdue: e.overdue,
        count: e.count, buckets: e.buckets,
      })),
      total: netted.total,
      overdue: netted.overdue,
      bucketTotals: netted.bucketTotals,
      source: "documents",
    }
  }

  const netByName: Record<string, number> = {}
  for (const c of contacts) {
    const key = canonical(c.name, mapping)
    netByName[key] = (netByName[key] ?? 0) + c.net
  }

  // Plain objects/arrays rather than Map/Set iterators — the project's
  // TS target predates downlevel iteration, so spreading an iterator here
  // fails the build.
  const docByName: Record<string, (typeof docAgeing.entities)[number]> = {}
  for (const e of docAgeing.entities) docByName[e.name] = e

  const names = Array.from(new Set(Object.keys(netByName).concat(Object.keys(docByName))))
  const emptyBuckets = () => Object.fromEntries(AGEING_BUCKETS.map(b => [b, 0])) as Record<string, number>

  const entities: NetPosition[] = []
  for (const name of names) {
    const net = netByName[name] ?? 0
    const d = docByName[name]
    const docTotal = d?.grossTotal ?? 0
    const buckets = d ? { ...d.buckets } : emptyBuckets()

    // Reconcile buckets to the authoritative net.
    let diff = net - docTotal
    if (diff > 0) {
      // Unexplained by open documents — opening balance, so it's oldest.
      buckets[AGEING_BUCKETS[AGEING_BUCKETS.length - 1]] += diff
    } else if (diff < 0) {
      // Credits/advances reduce the oldest first (FIFO).
      let left = -diff
      for (let i = AGEING_BUCKETS.length - 1; i >= 0 && left > 0; i--) {
        const b = AGEING_BUCKETS[i]
        const applied = Math.min(buckets[b], left)
        buckets[b] -= applied
        left -= applied
      }
    }

    const overdue = Math.min(
      Math.max(0, (d?.grossOverdue ?? 0) + Math.max(0, diff)),
      Math.max(0, net),
    )

    if (net === 0 && docTotal === 0) continue
    entities.push({ name, outstanding: net, overdue, count: d?.count ?? 0, buckets })
  }

  entities.sort((a, b) => b.outstanding - a.outstanding)

  return {
    entities,
    total: entities.reduce((s, e) => s + e.outstanding, 0),
    overdue: entities.reduce((s, e) => s + e.overdue, 0),
    bucketTotals: AGEING_BUCKETS.map(label => ({
      label,
      amount: entities.reduce((s, e) => s + e.buckets[label], 0),
    })),
    source: "zoho-contacts",
  }
}

// ── Server-side aggregation ─────────────────────────────────────
//
// Entity totals used to be computed by pulling every invoice/bill row into
// JS and reducing them — ~50 sequential HTTP round trips for 22k invoices
// before a page could render. Postgres can do this in one query, so these
// helpers push the GROUP BY down to the database and return a single
// json_agg value (the one-row/one-column shape proven to work here).
//
// due_date/date are stored as TEXT in ISO "YYYY-MM-DD" form, so
// lexicographic comparison against to_char(CURRENT_DATE,...) is a correct
// date comparison and lets the DB do the overdue split too.
export interface EntityTotal {
  entity_name: string
  total: number
  overdue: number
  count: number
}

// Unapplied advances per entity, keyed by canonical name by the caller.
//
// Receivables should be shown net of unearned revenue (money a customer has
// paid that isn't matched to any invoice), and payables net of prepaid
// expenses (money paid to a vendor not matched to any bill). Reporting the
// gross Zoho balance alone overstates both sides, because it ignores cash
// already sitting against that party.
// Zoho's own closing position per contact — the numbers behind the
// Vendor/Customer Balance Summary reports.
//
// `outstanding` here already includes opening balances, which cannot be
// reconstructed from invoices/bills alone. Summing document balances was
// therefore always going to disagree with Zoho: e.g. Swiggy shows a closing
// balance well above (billed − paid) purely because of an opening balance.
// `credits` are unapplied advances/credit notes sitting against the party.
export interface ContactBalance {
  name: string
  outstanding: number
  credits: number
  net: number
}

export async function getContactBalances(side: "payable" | "receivable"): Promise<ContactBalance[]> {
  await ensureTables()
  const sql = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
  const outCol = side === "payable" ? "outstanding_payable" : "outstanding_receivable"
  const credCol = side === "payable" ? "unused_credits_payable" : "unused_credits_receivable"

  const res = await sql(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
      SELECT COALESCE(NULLIF(TRIM(contact_name), ''), 'Unknown') AS name,
             COALESCE(SUM(${outCol}), 0)::float8  AS outstanding,
             COALESCE(SUM(${credCol}), 0)::float8 AS credits
      FROM zoho_contacts
      GROUP BY 1
    ) t
  `)

  const raw = rowsOf<{ data: unknown }>(res)[0]?.data
  if (!raw) return []
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw
  if (!Array.isArray(arr)) return []

  return (arr as { name: string; outstanding: number; credits: number }[])
    .map(r => ({
      name: r.name,
      outstanding: num(r.outstanding),
      credits: num(r.credits),
      net: num(r.outstanding) - num(r.credits),
    }))
    .filter(r => r.outstanding !== 0 || r.credits !== 0)
}

export async function getUnappliedByEntity(side: "payable" | "receivable"): Promise<Record<string, number>> {
  // Prefer Zoho's own unused-credits figure per contact; it accounts for
  // credit notes and advances that never appear as an unapplied payment.
  const contacts = await getContactBalances(side)
  if (contacts.some(c => c.credits !== 0)) {
    const out: Record<string, number> = {}
    for (const c of contacts) if (c.credits) out[c.name] = c.credits
    return out
  }
  return getUnappliedFromPayments(side)
}

async function getUnappliedFromPayments(side: "payable" | "receivable"): Promise<Record<string, number>> {
  await ensureTables()
  const sql = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
  const table = side === "payable" ? "zoho_vendorpayments" : "zoho_customerpayments"
  const nameCol = side === "payable" ? "vendor_name" : "customer_name"

  const res = await sql(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
      SELECT COALESCE(NULLIF(TRIM(${nameCol}), ''), 'Unknown') AS entity_name,
             COALESCE(SUM(unused_amount), 0)::float8 AS amt
      FROM ${table}
      WHERE COALESCE(unused_amount, 0) <> 0
      GROUP BY 1
    ) t
  `)

  const raw = rowsOf<{ data: unknown }>(res)[0]?.data
  if (!raw) return {}
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw
  if (!Array.isArray(arr)) return {}

  const out: Record<string, number> = {}
  for (const r of arr as { entity_name: string; amt: number }[]) {
    out[r.entity_name] = num(r.amt)
  }
  return out
}

export async function getEntityTotals(side: "payable" | "receivable"): Promise<EntityTotal[]> {
  const sql = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
  const table = side === "payable" ? "zoho_bills" : "zoho_invoices"
  const nameCol = side === "payable" ? "vendor_name" : "customer_name"

  const res = await sql(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
      SELECT
        COALESCE(NULLIF(TRIM(${nameCol}), ''), 'Unknown') AS entity_name,
        COALESCE(SUM(balance), 0)::float8 AS total,
        COALESCE(SUM(CASE WHEN balance > 0 AND due_date IS NOT NULL AND due_date <> ''
                          AND due_date < to_char(CURRENT_DATE, 'YYYY-MM-DD')
                     THEN balance ELSE 0 END), 0)::float8 AS overdue,
        COUNT(*)::int AS count
      FROM ${table}
      GROUP BY 1
    ) t
  `)

  const raw = rowsOf<{ data: unknown }>(res)[0]?.data
  if (!raw) return []
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw
  if (!Array.isArray(arr)) return []
  return (arr as EntityTotal[]).map(r => ({
    entity_name: r.entity_name,
    total: num(r.total),
    overdue: num(r.overdue),
    count: Number(r.count) || 0,
  }))
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
