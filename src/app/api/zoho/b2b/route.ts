import { NextRequest, NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedCustomerPayments as getPayments,
  getEntityMapping, canonical, getLastSyncedAt,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// B2B order tracker.
//
// Payment terms are milestone-based (50% on order confirmation, 30% prior
// to dispatch, 20% within 7 days of delivery), so the useful view is
// invoice-by-invoice: what was billed, what's come in, and which milestone
// that money covers.
//
// Per-invoice receipts are derived as (total - balance) rather than from
// the payments table, because Zoho's payment list doesn't say which invoice
// each payment was applied to — the invoice's own balance already reflects
// the allocation Zoho made.
const MILESTONES = [
  { key: "advance",  label: "50% Advance (Order Confirmation)", pct: 0.5 },
  { key: "dispatch", label: "30% Prior to Dispatch",            pct: 0.3 },
  { key: "delivery", label: "20% Within 7 Days of Delivery",    pct: 0.2 },
] as const

const EXCLUDED = new Set(["draft", "void", "voided"])
const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())

export async function GET(req: NextRequest) {
  try {
    const customerParam = req.nextUrl.searchParams.get("customer") || "Kulcha Kulture"
    const from = req.nextUrl.searchParams.get("from") || undefined
    const to   = req.nextUrl.searchParams.get("to")   || undefined

    const [allInvoices, payments, mapping] = await Promise.all([
      getInvoices(), getPayments(), getEntityMapping(),
    ])

    // Match on the canonical name so any of the customer's legal entities
    // roll into the same tracker.
    const target = customerParam.trim().toLowerCase()
    const matches = (raw: string) => {
      const c = canonical(raw, mapping).toLowerCase()
      return c === target || c.includes(target) || (raw ?? "").toLowerCase().includes(target)
    }

    const invoices = allInvoices
      .filter(i => isLive(i.status) && matches(i.customer_name))
      .filter(i => (!from || (i.date ?? "") >= from) && (!to || (i.date ?? "") <= to))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .map(i => {
        const total = i.total || 0
        const balance = i.balance || 0
        const received = total - balance
        const status = balance <= 0 ? "Paid" : received > 0 ? "Partial" : "Unpaid"
        return {
          invoice_id: i.invoice_id,
          date: i.date,
          invoice_number: i.invoice_number,
          customer_name: i.customer_name,
          total,
          received,
          balance,
          status,
          milestones: MILESTONES.map(m => ({
            key: m.key,
            label: m.label,
            due: total * m.pct,
            // How much of this milestone the receipts cover, filled in
            // order — receipts settle the earliest milestone first.
            covered: 0,
          })),
        }
      })

    // Allocate each invoice's receipts across its milestones in order.
    for (const inv of invoices) {
      let left = inv.received
      for (const m of inv.milestones) {
        const applied = Math.min(m.due, Math.max(0, left))
        m.covered = applied
        left -= applied
      }
    }

    const totals = {
      invoiced: invoices.reduce((s, i) => s + i.total, 0),
      received: invoices.reduce((s, i) => s + i.received, 0),
      outstanding: invoices.reduce((s, i) => s + i.balance, 0),
      count: invoices.length,
      paid: invoices.filter(i => i.status === "Paid").length,
      partial: invoices.filter(i => i.status === "Partial").length,
      unpaid: invoices.filter(i => i.status === "Unpaid").length,
    }

    // Payments recorded against this customer in the period — useful as a
    // cross-check against the invoice-derived receipts above.
    const receipts = payments
      .filter(p => matches(p.customer_name))
      .filter(p => (!from || (p.date ?? "") >= from) && (!to || (p.date ?? "") <= to))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .map(p => ({ payment_id: p.payment_id, date: p.date, amount: p.amount }))

    // Distinct B2B-ish customers, so the page can offer a picker.
    const customers = Array.from(
      new Set(allInvoices.filter(i => isLive(i.status)).map(i => canonical(i.customer_name, mapping)))
    ).sort()

    return NextResponse.json({
      customer: customerParam,
      invoices,
      receipts,
      totals,
      milestoneLabels: MILESTONES.map(m => m.label),
      customers,
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
