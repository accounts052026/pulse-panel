import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getCachedExpenses as getExpenses, getCachedBankAccounts as getBankAccounts,
  getLastSyncedAt,
} from "@/lib/zoho-store"
import { getNeon } from "@/lib/neon"

export const dynamic = "force-dynamic"

async function getMapping(): Promise<Record<string, string>> {
  try {
    const sql = getNeon()
    await sql`
      CREATE TABLE IF NOT EXISTS entity_mapping (
        entity_name    TEXT PRIMARY KEY,
        canonical_name TEXT NOT NULL,
        side           TEXT NOT NULL,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const rows = await sql`SELECT entity_name, canonical_name FROM entity_mapping`
    const map: Record<string, string> = {}
    for (const r of rows as unknown as { entity_name: string; canonical_name: string }[]) {
      map[r.entity_name] = r.canonical_name
    }
    return map
  } catch {
    return {} // mapping is optional — dashboard still works with raw Zoho names if Neon is unreachable
  }
}

interface AgeingBucket { label: string; amount: number }

function ageingBuckets(items: { balance: number; due_date: string }[]): AgeingBucket[] {
  const today = new Date()
  const buckets = { "0 - 30 Days": 0, "31 - 60 Days": 0, "61 - 90 Days": 0, "91 - 120 Days": 0, "> 120 Days": 0 }
  for (const it of items) {
    if (!it.balance) continue
    const due = new Date(it.due_date)
    const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
    if (days <= 30)      buckets["0 - 30 Days"]   += it.balance
    else if (days <= 60) buckets["31 - 60 Days"]  += it.balance
    else if (days <= 90) buckets["61 - 90 Days"]  += it.balance
    else if (days <= 120)buckets["91 - 120 Days"] += it.balance
    else                 buckets["> 120 Days"]    += it.balance
  }
  return Object.entries(buckets).map(([label, amount]) => ({ label, amount }))
}

function isOverdue(due_date: string, balance: number) {
  return balance > 0 && new Date(due_date) < new Date()
}

function topByEntity<T extends { balance: number }>(items: T[], nameKey: keyof T, mapping: Record<string, string>, n = 5) {
  const map: Record<string, { total: number; overdue: number }> = {}
  for (const it of items) {
    const raw  = String(it[nameKey] ?? "Unknown")
    const name = mapping[raw] ?? raw
    if (!map[name]) map[name] = { total: 0, overdue: 0 }
    map[name].total += it.balance
    if (isOverdue((it as any).due_date, it.balance)) map[name].overdue += it.balance
  }
  const rows = Object.entries(map)
    .map(([name, v]) => ({ name, total: v.total, overdue: v.overdue, pct: v.total ? (v.overdue / v.total) * 100 : 0 }))
    .filter(r => r.total !== 0)
    .sort((a, b) => b.total - a.total)
  return { top: rows.slice(0, n), rest: rows.slice(n) }
}

function monthKey(d: string) { return d?.slice(0, 7) ?? "Unknown" }

export async function GET() {
  try {
    const [invoices, bills, expenses, bankAccounts, mapping] = await Promise.all([
      getInvoices(), getBills(), getExpenses(), getBankAccounts(), getMapping(),
    ])

    // ── KPI totals ──────────────────────────────────────────────
    const totalPayables    = bills.reduce((s, b) => s + (b.balance || 0), 0)
    const totalReceivables = invoices.reduce((s, i) => s + (i.balance || 0), 0)
    const payablesOverdue    = bills.filter(b => isOverdue(b.due_date, b.balance)).reduce((s, b) => s + b.balance, 0)
    const receivablesOverdue = invoices.filter(i => isOverdue(i.due_date, i.balance)).reduce((s, i) => s + i.balance, 0)

    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`

    const expensesThisMonth = expenses.filter(e => monthKey(e.date) === thisMonthKey).reduce((s, e) => s + (e.total || 0), 0)
    const expensesLastMonth = expenses.filter(e => monthKey(e.date) === lastMonthKey).reduce((s, e) => s + (e.total || 0), 0)
    const expensesMomPct = expensesLastMonth ? ((expensesThisMonth - expensesLastMonth) / expensesLastMonth) * 100 : 0

    const cashAndBankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0)

    // ── Ageing ──────────────────────────────────────────────────
    const payablesAgeing    = ageingBuckets(bills)
    const receivablesAgeing = ageingBuckets(invoices)

    // ── Expense by category (this month) ─────────────────────────
    const catMap: Record<string, number> = {}
    for (const e of expenses.filter(e => monthKey(e.date) === thisMonthKey)) {
      const cat = e.account_name || "Other"
      catMap[cat] = (catMap[cat] || 0) + (e.total || 0)
    }
    const expenseByCategory = Object.entries(catMap)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)

    // ── Top vendors / customers ──────────────────────────────────
    const payablesByVendor   = topByEntity(bills, "vendor_name", mapping)
    const receivablesByCustomer = topByEntity(invoices, "customer_name", mapping)

    // ── Top overdue invoices/bills ─────────────────────────────
    // party name was previously read straight off the raw Zoho record —
    // skipping the canonical-name lookup entirely, so this card kept
    // showing raw/duplicate vendor names even after mapping them in
    // Entity Master. Apply the same `mapping[raw] ?? raw` lookup used by
    // the top-vendor/customer tables above.
    const overdueBills = bills
      .filter(b => isOverdue(b.due_date, b.balance))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map(b => ({ doc_no: b.bill_number, party: mapping[b.vendor_name] ?? b.vendor_name, due_date: b.due_date, overdue: b.balance, side: "payable" as const }))

    const overdueInvoices = invoices
      .filter(i => isOverdue(i.due_date, i.balance))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map(i => ({ doc_no: i.invoice_number, party: mapping[i.customer_name] ?? i.customer_name, due_date: i.due_date, overdue: i.balance, side: "receivable" as const }))

    // ── Trend — last 6 months ────────────────────────────────────
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
    const trend = months.map(m => ({
      month: m,
      payables:    bills.filter(b => monthKey(b.date) === m).reduce((s, b) => s + (b.total || 0), 0),
      receivables: invoices.filter(i => monthKey(i.date) === m).reduce((s, i) => s + (i.total || 0), 0),
      expenses:    expenses.filter(e => monthKey(e.date) === m).reduce((s, e) => s + (e.total || 0), 0),
    }))

    // ── Summary stats ─────────────────────────────────────────────
    const openInvoices  = invoices.filter(i => i.balance > 0).length
    const overdueCount  = invoices.filter(i => isOverdue(i.due_date, i.balance)).length + bills.filter(b => isOverdue(b.due_date, b.balance)).length

    const avgPaymentDays = avgDaysToClose(bills.filter(b => b.status === "paid"))
    const avgCollectionDays = avgDaysToClose(invoices.filter(i => i.status === "paid"))

    return NextResponse.json({
      kpis: {
        totalPayables, totalReceivables, payablesOverdue, receivablesOverdue,
        payablesOverduePct: totalPayables ? (payablesOverdue / totalPayables) * 100 : 0,
        receivablesOverduePct: totalReceivables ? (receivablesOverdue / totalReceivables) * 100 : 0,
        expensesThisMonth, expensesMomPct, cashAndBankBalance,
      },
      payablesAgeing, receivablesAgeing, expenseByCategory,
      payablesByVendor, receivablesByCustomer,
      overdueTop: [...overdueBills, ...overdueInvoices].sort((a, b) => b.overdue - a.overdue).slice(0, 10),
      trend,
      summary: {
        avgPaymentDays, avgCollectionDays,
        openInvoices, overdueCount,
      },
      asOf: (await getLastSyncedAt()) ?? now.toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Rough average days-to-close — needs last_payment_date on the record;
// Zoho's list endpoints don't always include it, so this degrades gracefully to 0.
function avgDaysToClose(items: { date: string; last_payment_date?: string }[]): number {
  const withDates = items.filter(i => i.last_payment_date)
  if (!withDates.length) return 0
  const total = withDates.reduce((s, i) => {
    const days = (new Date(i.last_payment_date!).getTime() - new Date(i.date).getTime()) / 86_400_000
    return s + days
  }, 0)
  return Math.round(total / withDates.length)
}
