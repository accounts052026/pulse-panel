import { NextRequest, NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getCachedExpenses as getExpenses, getCachedBankAccounts as getBankAccounts,
  getLastSyncedAt, getEntityMapping, canonical, getUnappliedByEntity,
  computeNetAgeing, getContactBalances,
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

// asOn lets overdue be evaluated at the period end rather than always today,
// so a past period reports the position as it stood then.
function isOverdue(due_date: string, balance: number, asOn: Date = new Date()) {
  return balance > 0 && new Date(due_date) < asOn
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

    const [allInvoices, allBills, allExpenses, bankAccounts, mapping, unappliedAr, unappliedAp, contactsAr, contactsAp] = await Promise.all([
      getInvoices(), getBills(), getExpenses(), getBankAccounts(), getEntityMapping(),
      getUnappliedByEntity("receivable"), getUnappliedByEntity("payable"),
      getContactBalances("receivable"), getContactBalances("payable"),
    ])

    // Balances are a snapshot as of today and are deliberately NOT filtered
    // by the selected date range — an invoice raised in a prior year that is
    // still unpaid is still receivable now. Date-filtering them is what made
    // this page disagree with the Receivables/Payables/Ageing tabs (1.84 Cr
    // here vs 3.36 Cr there, on identical data).
    const invoices = allInvoices.filter(i => isLive(i.status))
    const bills    = allBills.filter(b => isLive(b.status))
    // Expenses are a flow, so the range genuinely applies to them.
    const expenses = allExpenses.filter(e => inRange(e.date, from, to))

    // ── KPI totals ──────────────────────────────────────────────
    // Derived from the SAME shared calculation the other tabs use, so the
    // figures agree by construction rather than by coincidence.
    // Balances are reported "as on" the period end, capped at today (the
    // current FY ends in the future and we can't show a future position).
    // With the default FY this resolves to today, so the dashboard still
    // ties exactly to the Payables/Receivables/Ageing tabs; picking a past
    // period shows that historical position instead of a static one.
    const todayDate = new Date()
    const toDate = new Date(to)
    const asOn = toDate < todayDate ? toDate : todayDate
    const asOnIsPast = toDate < todayDate

    const arNet = computeNetAgeing(invoices, "customer_name", mapping, unappliedAr, asOn)
    const apNet = computeNetAgeing(bills, "vendor_name", mapping, unappliedAp, asOn)

    // Zoho's own closing position — matches the Vendor/Customer Balance
    // Summary reports exactly, because it includes opening balances and
    // credits that document-level balances can't reproduce. This is the
    // figure the headline KPIs report, so the dashboard ties to Zoho.
    const sumNet = (rows: { net: number }[]) => rows.reduce((s, r) => s + r.net, 0)
    const sumOut = (rows: { outstanding: number }[]) => rows.reduce((s, r) => s + r.outstanding, 0)
    const sumCredits = (rows: { credits: number }[]) => rows.reduce((s, r) => s + r.credits, 0)

    // Zoho's contact balances are a CURRENT snapshot — they carry no history,
    // so they're only valid when the as-on date is today. For a past period
    // we fall back to the document-derived position, which can be rebuilt
    // for any date.
    const haveContacts = !asOnIsPast && (contactsAp.length > 0 || contactsAr.length > 0)

    const unearnedRevenue = haveContacts ? sumCredits(contactsAr) : arNet.advance
    const prepaidExpenses = haveContacts ? sumCredits(contactsAp) : apNet.advance
    const grossPayables    = haveContacts ? sumOut(contactsAp) : apNet.grossTotal
    const grossReceivables = haveContacts ? sumOut(contactsAr) : arNet.grossTotal
    const totalPayables    = haveContacts ? sumNet(contactsAp) : apNet.total
    const totalReceivables = haveContacts ? sumNet(contactsAr) : arNet.total

    // Overdue still comes from documents (contacts carry no due dates), so
    // it's capped at the authoritative net to stay internally consistent.
    const payablesOverdue    = Math.min(apNet.overdue, Math.max(0, totalPayables))
    const receivablesOverdue = Math.min(arNet.overdue, Math.max(0, totalReceivables))

    // Difference between Zoho's closing position and the sum of open
    // documents — opening balances, and anything not represented by an
    // invoice/bill. Surfaced rather than silently absorbed.
    const payablesUnreconciled    = totalPayables - apNet.total
    const receivablesUnreconciled = totalReceivables - arNet.total

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
    // Straight from the shared calculation, so these donuts sum exactly to
    // the KPI cards above them and to the Ageing Analysis tab.
    const payablesAgeing    = apNet.bucketTotals
    const receivablesAgeing = arNet.bucketTotals

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
    // Taken from the shared net calculation so these rows tie back to the
    // Payables/Receivables tabs instead of being computed a second way.
    const topFrom = (net: typeof arNet, n = 5) => {
      const rows = net.entities
        .map(e => ({ name: e.name, total: e.total, overdue: e.overdue, pct: e.total > 0 ? Math.min(100, (e.overdue / e.total) * 100) : 0 }))
        .filter(r => r.total !== 0)
      return { top: rows.slice(0, n), rest: rows.slice(n) }
    }
    const payablesByVendor      = topFrom(apNet)
    const receivablesByCustomer = topFrom(arNet)

    // ── Top overdue invoices/bills ─────────────────────────────
    // party name was previously read straight off the raw Zoho record —
    // skipping the canonical-name lookup entirely, so this card kept
    // showing raw/duplicate vendor names even after mapping them in
    // Entity Master. Apply the same `mapping[raw] ?? raw` lookup used by
    // the top-vendor/customer tables above.
    const asOnIsoStr = asOn.toISOString().slice(0, 10)
    const overdueBills = bills
      .filter(b => (!b.date || b.date.slice(0, 10) <= asOnIsoStr) && isOverdue(b.due_date, b.balance, asOn))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map(b => ({ doc_no: b.bill_number, party: canonical(b.vendor_name, mapping), due_date: b.due_date, overdue: b.balance, side: "payable" as const }))

    const overdueInvoices = invoices
      .filter(i => (!i.date || i.date.slice(0, 10) <= asOnIsoStr) && isOverdue(i.due_date, i.balance, asOn))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map(i => ({ doc_no: i.invoice_number, party: canonical(i.customer_name, mapping), due_date: i.due_date, overdue: i.balance, side: "receivable" as const }))

    // ── Trend — every month in the selected period ───────────────
    // Previously hardcoded to the last 6 months, so the charts sat
    // unchanged whatever period was picked. Now it walks the actual range
    // (capped at 24 points so a multi-year range stays readable).
    const months: string[] = []
    const trendStart = new Date(from)
    const trendEnd = toDate < todayDate ? toDate : todayDate
    const cursor = new Date(trendStart.getFullYear(), trendStart.getMonth(), 1)
    while (cursor <= trendEnd && months.length < 24) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)
      cursor.setMonth(cursor.getMonth() + 1)
    }
    if (months.length === 0) {
      const d = new Date(trendEnd.getFullYear(), trendEnd.getMonth(), 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
    const trend = months.map(m => ({
      month: m,
      payables:    bills.filter(b => monthKey(b.date) === m).reduce((s, b) => s + (b.total || 0), 0),
      receivables: invoices.filter(i => monthKey(i.date) === m).reduce((s, i) => s + (i.total || 0), 0),
      expenses:    expenses.filter(e => monthKey(e.date) === m).reduce((s, e) => s + (e.total || 0), 0),
    }))

    // ── Summary stats ─────────────────────────────────────────────
    const openInvoices  = invoices.filter(i => i.balance > 0 && (!i.date || i.date.slice(0, 10) <= asOnIsoStr)).length
    const overdueCount  = invoices.filter(i => isOverdue(i.due_date, i.balance, asOn)).length
                        + bills.filter(b => isOverdue(b.due_date, b.balance, asOn)).length

    const avgPaymentDays = avgDaysToClose(bills.filter(b => b.status === "paid"))
    const avgCollectionDays = avgDaysToClose(invoices.filter(i => i.status === "paid"))

    return NextResponse.json({
      kpis: {
        totalPayables, totalReceivables, payablesOverdue, receivablesOverdue,
        payablesOverduePct: totalPayables > 0 ? Math.min(100, (payablesOverdue / totalPayables) * 100) : 0,
        receivablesOverduePct: totalReceivables > 0 ? Math.min(100, (receivablesOverdue / totalReceivables) * 100) : 0,
        expensesThisMonth, expensesMomPct, cashAndBankBalance,
        grossPayables, grossReceivables, unearnedRevenue, prepaidExpenses,
        payablesUnreconciled, receivablesUnreconciled,
        source: haveContacts ? "zoho-contacts" : "documents",
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
