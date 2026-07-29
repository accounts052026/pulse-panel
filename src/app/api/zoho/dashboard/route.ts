import { NextRequest, NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getCachedExpenses as getExpenses, getCachedBankAccounts as getBankAccounts,
  getLastSyncedAt, getEntityMapping, canonical, getUnappliedByEntity,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
// Reading ~23k invoices back out of Neon takes many round trips; the
// default 10s serverless budget was not enough headroom.
export const maxDuration = 60

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
    const name = canonical(it[nameKey] as unknown as string, mapping)
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

// Indian financial year: 1 April → 31 March. Used when no range is supplied.
function defaultFinancialYear(): { from: string; to: string } {
  const now = new Date()
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}

// Dates are stored as ISO "YYYY-MM-DD" text, so string comparison is a
// correct date comparison.
function inRange(date: string | undefined, from: string, to: string) {
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= from && d <= to
}

// Zoho's own "Total Unpaid" figures exclude drafts and voided documents;
// including them here made the dashboard read higher than Zoho Books.
const EXCLUDED_STATUSES = new Set(["draft", "void", "voided"])
function isLive(status: string | undefined) {
  return !EXCLUDED_STATUSES.has((status ?? "").toLowerCase())
}

export async function GET(req: NextRequest) {
  try {
    const fy = defaultFinancialYear()
    const from = req.nextUrl.searchParams.get("from") || fy.from
    const to   = req.nextUrl.searchParams.get("to")   || fy.to

    const [allInvoices, allBills, allExpenses, bankAccounts, mapping, unappliedAr, unappliedAp] = await Promise.all([
      getInvoices(), getBills(), getExpenses(), getBankAccounts(), getEntityMapping(),
      getUnappliedByEntity("receivable"), getUnappliedByEntity("payable"),
    ])

    const sumUnapplied = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0)
    const unearnedRevenue = sumUnapplied(unappliedAr) // customer advances
    const prepaidExpenses = sumUnapplied(unappliedAp) // vendor advances

    const invoices = allInvoices.filter(i => isLive(i.status) && inRange(i.date, from, to))
    const bills    = allBills.filter(b => isLive(b.status) && inRange(b.date, from, to))
    const expenses = allExpenses.filter(e => inRange(e.date, from, to))

    // ── KPI totals ──────────────────────────────────────────────
    // Net of advances: receivables less unearned revenue, payables less
    // prepaid expenses. The gross Zoho balance ignores cash already held
    // against the party and so overstates both sides.
    const grossPayables    = bills.reduce((s, b) => s + (b.balance || 0), 0)
    const grossReceivables = invoices.reduce((s, i) => s + (i.balance || 0), 0)
    const totalPayables    = grossPayables - prepaidExpenses
    const totalReceivables = grossReceivables - unearnedRevenue
    // FIFO — advances settle the oldest documents first, so they absorb
    // overdue balances before current ones. Netting the total but leaving
    // overdue gross is what made overdue exceed 100% of the total.
    const grossPayablesOverdue    = bills.filter(b => isOverdue(b.due_date, b.balance)).reduce((s, b) => s + b.balance, 0)
    const grossReceivablesOverdue = invoices.filter(i => isOverdue(i.due_date, i.balance)).reduce((s, i) => s + i.balance, 0)
    const payablesOverdue    = Math.max(0, grossPayablesOverdue - prepaidExpenses)
    const receivablesOverdue = Math.max(0, grossReceivablesOverdue - unearnedRevenue)

    const now = new Date()

    // Expenses are summed over the selected range, and compared against the
    // immediately preceding window of the same length so the comparison stays
    // meaningful whichever range is chosen.
    const expensesThisMonth = expenses.reduce((s, e) => s + (e.total || 0), 0)

    const fromMs = new Date(from).getTime()
    const toMs   = new Date(to).getTime()
    const spanMs = Math.max(toMs - fromMs, 86_400_000)
    const prevFrom = new Date(fromMs - spanMs).toISOString().slice(0, 10)
    const prevTo   = new Date(fromMs - 86_400_000).toISOString().slice(0, 10)
    const expensesLastMonth = allExpenses
      .filter(e => inRange(e.date, prevFrom, prevTo))
      .reduce((s, e) => s + (e.total || 0), 0)
    const expensesMomPct = expensesLastMonth ? ((expensesThisMonth - expensesLastMonth) / expensesLastMonth) * 100 : 0

    const cashAndBankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0)

    // ── Ageing ──────────────────────────────────────────────────
    // Advances applied FIFO (oldest bucket first) so these donuts sum to the
    // same net figure shown on the KPI cards above them.
    const applyAdvanceFifo = (buckets: AgeingBucket[], advance: number): AgeingBucket[] => {
      let left = advance
      const out = buckets.map(b => ({ ...b }))
      for (let i = out.length - 1; i >= 0 && left > 0; i--) {
        const applied = Math.min(out[i].amount, left)
        out[i].amount -= applied
        left -= applied
      }
      return out
    }

    const payablesAgeing    = applyAdvanceFifo(ageingBuckets(bills), prepaidExpenses)
    const receivablesAgeing = applyAdvanceFifo(ageingBuckets(invoices), unearnedRevenue)

    // ── Expense by category (selected range) ─────────────────────
    const catMap: Record<string, number> = {}
    for (const e of expenses) {
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
      .slice(0, 5)
      .map(b => ({ doc_no: b.bill_number, party: canonical(b.vendor_name, mapping), due_date: b.due_date, overdue: b.balance, side: "payable" as const }))

    const overdueInvoices = invoices
      .filter(i => isOverdue(i.due_date, i.balance))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map(i => ({ doc_no: i.invoice_number, party: canonical(i.customer_name, mapping), due_date: i.due_date, overdue: i.balance, side: "receivable" as const }))

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
        payablesOverduePct: totalPayables > 0 ? Math.min(100, (payablesOverdue / totalPayables) * 100) : 0,
        receivablesOverduePct: totalReceivables > 0 ? Math.min(100, (receivablesOverdue / totalReceivables) * 100) : 0,
        expensesThisMonth, expensesMomPct, cashAndBankBalance,
        grossPayables, grossReceivables, unearnedRevenue, prepaidExpenses,
      },
      payablesAgeing, receivablesAgeing, expenseByCategory,
      payablesByVendor, receivablesByCustomer,
      // Both sides kept whole (5 each) rather than combined-then-truncated,
      // which used to leave one tab nearly empty and the other overfull —
      // and made this card tower over the two Top-5 tables beside it.
      overdueTop: [...overdueBills, ...overdueInvoices],
      trend,
      summary: {
        avgPaymentDays, avgCollectionDays,
        openInvoices, overdueCount,
      },
      range: { from, to },
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
