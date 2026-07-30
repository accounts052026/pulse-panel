import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getLastSyncedAt, getEntityMapping, getNetPositions, AGEING_BUCKETS,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

const EXCLUDED = new Set(["draft", "void", "voided"])
const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())

export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([
      getInvoices(), getBills(), getEntityMapping(),
    ])

    // Same net position source as every other page, so the totals here
    // match the Payables/Receivables tabs and the dashboard exactly.
    const [ap, ar] = await Promise.all([
      getNetPositions("payable", mapping, bills.filter(b => isLive(b.status)), "vendor_name"),
      getNetPositions("receivable", mapping, invoices.filter(i => isLive(i.status)), "customer_name"),
    ])

    const shape = (r: typeof ap) => r.entities.map(e => ({
      name: e.name,
      buckets: e.buckets,
      total: e.outstanding,
      overdue: e.overdue,
      count: e.count,
    }))

    return NextResponse.json({
      buckets: AGEING_BUCKETS,
      payables: shape(ap),
      receivables: shape(ar),
      totals: {
        payables: { total: ap.total, overdue: ap.overdue },
        receivables: { total: ar.total, overdue: ar.overdue },
      },
      source: ap.source,
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
