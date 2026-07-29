import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getLastSyncedAt, getEntityMapping, getUnappliedByEntity,
  computeNetAgeing, AGEING_BUCKETS,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Draft/void documents are excluded here exactly as they are on the
// dashboard — Zoho leaves them out of its own outstanding figures, and
// including them on one screen but not another is another way these tabs
// used to disagree.
const EXCLUDED = new Set(["draft", "void", "voided"])
const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())

export async function GET() {
  try {
    const [invoices, bills, mapping, unappliedAp, unappliedAr] = await Promise.all([
      getInvoices(), getBills(), getEntityMapping(),
      getUnappliedByEntity("payable"), getUnappliedByEntity("receivable"),
    ])

    // Same shared calculation the dashboard and ledger tabs use — this page
    // no longer has its own bucketing/netting logic to drift out of step.
    const ap = computeNetAgeing(bills.filter(b => isLive(b.status)), "vendor_name", mapping, unappliedAp)
    const ar = computeNetAgeing(invoices.filter(i => isLive(i.status)), "customer_name", mapping, unappliedAr)

    return NextResponse.json({
      buckets: AGEING_BUCKETS,
      payables: ap.entities,
      receivables: ar.entities,
      totals: {
        payables: { total: ap.total, grossTotal: ap.grossTotal, advance: ap.advance, overdue: ap.overdue },
        receivables: { total: ar.total, grossTotal: ar.grossTotal, advance: ar.advance, overdue: ar.overdue },
      },
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
