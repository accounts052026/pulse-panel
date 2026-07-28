// ── Zoho data cache (Neon-backed, per-module tables) ───────────
// Instead of calling the Zoho Books API on every dashboard page load, or
// trying to sync all 9 modules in one long-running request (which risks
// hitting the serverless function's execution time limit and returning a
// non-JSON platform error page), each module gets its own table and its
// own short sync call. Rows are upserted in batches.

import { getNeon } from "./neon"
import {
  getInvoices, getBills, getCreditNotes, getVendorCredits,
  getCustomerPayments, getVendorPayments, getJournals,
  getExpenses, getBankAccounts,
} from "./zoho"

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
}

// Sync exactly one module: fetch from Zoho, batch-upsert into its table.
// Short-lived and independent — a failure or slowness in one module never
// affects the others, and each call comfortably fits well inside any
// serverless function time limit.
export async function syncModule(module: ZohoModule): Promise<{ module: string; count: number }> {
  await ensureTables()
  const sql = getNeon()

  try {
    let count = 0

    if (module === "invoices") {
      const rows = await getInvoices()
      for (let i = 0; i < rows.length; i += BATCH) {
        for (const r of rows.slice(i, i + BATCH)) {
          await sql`
            INSERT INTO zoho_invoices (invoice_id, invoice_number, customer_name, date, due_date, total, balance, status, synced_at)
            VALUES (${r.invoice_id}, ${r.invoice_number}, ${r.customer_name}, ${r.date}, ${r.due_date}, ${r.total || 0}, ${r.balance || 0}, ${r.status}, NOW())
            ON CONFLICT (invoice_id) DO UPDATE SET
              invoice_number=EXCLUDED.invoice_number, customer_name=EXCLUDED.customer_name,
              date=EXCLUDED.date, due_date=EXCLUDED.due_date, total=EXCLUDED.total,
              balance=EXCLUDED.balance, status=EXCLUDED.status, synced_at=NOW()
          `
        }
      }
      count = rows.length
    }

    else if (module === "bills") {
      const rows = await getBills()
      for (let i = 0; i < rows.length; i += BATCH) {
        for (const r of rows.slice(i, i + BATCH)) {
          await sql`
            INSERT INTO zoho_bills (bill_id, bill_number, vendor_name, date, due_date, total, balance, status, synced_at)
            VALUES (${r.bill_id}, ${r.bill_number}, ${r.vendor_name}, ${r.date}, ${r.due_date}, ${r.total || 0}, ${r.balance || 0}, ${r.status}, NOW())
            ON CONFLICT (bill_id) DO UPDATE SET
              bill_number=EXCLUDED.bill_number, vendor_name=EXCLUDED.vendor_name,
              date=EXCLUDED.date, due_date=EXCLUDED.due_date, total=EXCLUDED.total,
              balance=EXCLUDED.balance, status=EXCLUDED.status, synced_at=NOW()
          `
        }
      }
      count = rows.length
    }

    else if (module === "creditnotes") {
      const rows = await getCreditNotes()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_creditnotes (creditnote_id, customer_name, date, total, status, synced_at)
          VALUES (${r.creditnote_id}, ${r.customer_name}, ${r.date}, ${r.total || 0}, ${r.status}, NOW())
          ON CONFLICT (creditnote_id) DO UPDATE SET
            customer_name=EXCLUDED.customer_name, date=EXCLUDED.date,
            total=EXCLUDED.total, status=EXCLUDED.status, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "vendorcredits") {
      const rows = await getVendorCredits()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_vendorcredits (vendor_credit_id, vendor_name, date, total, status, synced_at)
          VALUES (${r.vendor_credit_id}, ${r.vendor_name}, ${r.date}, ${r.total || 0}, ${r.status}, NOW())
          ON CONFLICT (vendor_credit_id) DO UPDATE SET
            vendor_name=EXCLUDED.vendor_name, date=EXCLUDED.date,
            total=EXCLUDED.total, status=EXCLUDED.status, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "customerpayments") {
      const rows = await getCustomerPayments()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_customerpayments (payment_id, customer_name, date, amount, tax_amount_withheld, synced_at)
          VALUES (${r.payment_id}, ${r.customer_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, NOW())
          ON CONFLICT (payment_id) DO UPDATE SET
            customer_name=EXCLUDED.customer_name, date=EXCLUDED.date,
            amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "vendorpayments") {
      const rows = await getVendorPayments()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_vendorpayments (payment_id, vendor_name, date, amount, tax_amount_withheld, synced_at)
          VALUES (${r.payment_id}, ${r.vendor_name}, ${r.date}, ${r.amount || 0}, ${r.tax_amount_withheld || 0}, NOW())
          ON CONFLICT (payment_id) DO UPDATE SET
            vendor_name=EXCLUDED.vendor_name, date=EXCLUDED.date,
            amount=EXCLUDED.amount, tax_amount_withheld=EXCLUDED.tax_amount_withheld, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "journals") {
      const rows = await getJournals()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_journals (journal_id, journal_date, reference_number, total, line_items, synced_at)
          VALUES (${r.journal_id}, ${r.journal_date}, ${r.reference_number || ""}, ${r.total || 0}, ${JSON.stringify(r.line_items || [])}::jsonb, NOW())
          ON CONFLICT (journal_id) DO UPDATE SET
            journal_date=EXCLUDED.journal_date, reference_number=EXCLUDED.reference_number,
            total=EXCLUDED.total, line_items=EXCLUDED.line_items, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "expenses") {
      const rows = await getExpenses()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_expenses (expense_id, account_name, vendor_name, date, total, synced_at)
          VALUES (${r.expense_id}, ${r.account_name}, ${r.vendor_name || ""}, ${r.date}, ${r.total || 0}, NOW())
          ON CONFLICT (expense_id) DO UPDATE SET
            account_name=EXCLUDED.account_name, vendor_name=EXCLUDED.vendor_name,
            date=EXCLUDED.date, total=EXCLUDED.total, synced_at=NOW()
        `
      }
      count = rows.length
    }

    else if (module === "bankaccounts") {
      const rows = await getBankAccounts()
      for (const r of rows) {
        await sql`
          INSERT INTO zoho_bankaccounts (account_id, account_name, balance, synced_at)
          VALUES (${r.account_id}, ${r.account_name}, ${r.balance || 0}, NOW())
          ON CONFLICT (account_id) DO UPDATE SET
            account_name=EXCLUDED.account_name, balance=EXCLUDED.balance, synced_at=NOW()
        `
      }
      count = rows.length
    }

    await sql`
      INSERT INTO zoho_sync_status (module, row_count, synced_at, error)
      VALUES (${module}, ${count}, NOW(), NULL)
      ON CONFLICT (module) DO UPDATE SET row_count=EXCLUDED.row_count, synced_at=NOW(), error=NULL
    `
    return { module, count }
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

// ── Typed readers used by the dashboard/entities/entity-snapshot routes ──

export async function getCachedInvoices() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT invoice_id, invoice_number, customer_name, date, due_date, total, balance, status FROM zoho_invoices`) as unknown as
    { invoice_id: string; invoice_number: string; customer_name: string; date: string; due_date: string; total: number; balance: number; status: string }[]
}

export async function getCachedBills() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT bill_id, bill_number, vendor_name, date, due_date, total, balance, status FROM zoho_bills`) as unknown as
    { bill_id: string; bill_number: string; vendor_name: string; date: string; due_date: string; total: number; balance: number; status: string }[]
}

export async function getCachedCreditNotes() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT creditnote_id, customer_name, date, total, status FROM zoho_creditnotes`) as unknown as
    { creditnote_id: string; customer_name: string; date: string; total: number; status: string }[]
}

export async function getCachedVendorCredits() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT vendor_credit_id, vendor_name, date, total, status FROM zoho_vendorcredits`) as unknown as
    { vendor_credit_id: string; vendor_name: string; date: string; total: number; status: string }[]
}

export async function getCachedCustomerPayments() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT payment_id, customer_name, date, amount, tax_amount_withheld FROM zoho_customerpayments`) as unknown as
    { payment_id: string; customer_name: string; date: string; amount: number; tax_amount_withheld: number }[]
}

export async function getCachedVendorPayments() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT payment_id, vendor_name, date, amount, tax_amount_withheld FROM zoho_vendorpayments`) as unknown as
    { payment_id: string; vendor_name: string; date: string; amount: number; tax_amount_withheld: number }[]
}

export async function getCachedJournals() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT journal_id, journal_date, reference_number, total, line_items FROM zoho_journals`) as unknown as
    { journal_id: string; journal_date: string; reference_number: string; total: number; line_items: any[] }[]
}

export async function getCachedExpenses() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT expense_id, account_name, vendor_name, date, total FROM zoho_expenses`) as unknown as
    { expense_id: string; account_name: string; vendor_name: string; date: string; total: number }[]
}

export async function getCachedBankAccounts() {
  await ensureTables()
  const sql = getNeon()
  return (await sql`SELECT account_id, account_name, balance FROM zoho_bankaccounts`) as unknown as
    { account_id: string; account_name: string; balance: number }[]
}
