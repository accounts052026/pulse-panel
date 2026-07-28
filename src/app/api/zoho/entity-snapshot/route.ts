import { NextRequest, NextResponse } from "next/server"
import type {
  ZohoInvoice, ZohoBill, ZohoCreditNote, ZohoVendorCredit,
  ZohoCustomerPayment, ZohoVendorPayment, ZohoJournal,
} from "@/lib/zoho"
import { getCachedModule } from "@/lib/zoho-store"
import { getNeon } from "@/lib/neon"

const getInvoices         = () => getCachedModule<ZohoInvoice>("invoices")
const getBills            = () => getCachedModule<ZohoBill>("bills")
const getCreditNotes      = () => getCachedModule<ZohoCreditNote>("creditnotes")
const getVendorCredits    = () => getCachedModule<ZohoVendorCredit>("vendorcredits")
const getCustomerPayments = () => getCachedModule<ZohoCustomerPayment>("customerpayments")
const getVendorPayments   = () => getCachedModule<ZohoVendorPayment>("vendorpayments")
const getJournals         = () => getCachedModule<ZohoJournal>("journals")

export const dynamic = "force-dynamic"

interface EntityBucket {
  invoiced: number
  payment: number
  creditDebitNote: number
  journal: number
  tds: number
}
function emptyBucket(): EntityBucket {
  return { invoiced: 0, payment: 0, creditDebitNote: 0, journal: 0, tds: 0 }
}

function inRange(date: string, from?: string, to?: string) {
  if (!date) return true
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

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
    return {}
  }
}

// GET /api/zoho/entity-snapshot?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns entity-wise (customer-wise AR, vendor-wise AP) breakdown using the
// exact entity names as they exist in Zoho Books, filtered to the chosen
// date range, with any saved canonical-name mappings applied.
export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from") || undefined
    const to   = req.nextUrl.searchParams.get("to") || undefined

    const [invoices, bills, creditNotes, vendorCredits, customerPayments, vendorPayments, journals, mapping] =
      await Promise.all([
        getInvoices(), getBills(), getCreditNotes(), getVendorCredits(),
        getCustomerPayments(), getVendorPayments(), getJournals(), getMapping(),
      ])

    const arBuckets: Record<string, EntityBucket> = {}
    const apBuckets: Record<string, EntityBucket> = {}

    const bucketFor = (store: Record<string, EntityBucket>, rawName: string) => {
      const name = mapping[rawName] ?? rawName
      return store[name] ?? (store[name] = emptyBucket())
    }

    for (const inv of invoices) {
      if (!inRange(inv.date, from, to)) continue
      bucketFor(arBuckets, inv.customer_name || "Unknown").invoiced += inv.total || 0
    }
    for (const cn of creditNotes) {
      if (!inRange(cn.date, from, to)) continue
      bucketFor(arBuckets, cn.customer_name || "Unknown").creditDebitNote += cn.total || 0
    }
    for (const p of customerPayments) {
      if (!inRange(p.date, from, to)) continue
      const b = bucketFor(arBuckets, p.customer_name || "Unknown")
      b.payment += p.amount || 0
      b.tds     += p.tax_amount_withheld || 0
    }

    for (const bill of bills) {
      if (!inRange(bill.date, from, to)) continue
      bucketFor(apBuckets, bill.vendor_name || "Unknown").invoiced += bill.total || 0
    }
    for (const vc of vendorCredits) {
      if (!inRange(vc.date, from, to)) continue
      bucketFor(apBuckets, vc.vendor_name || "Unknown").creditDebitNote += vc.total || 0
    }
    for (const p of vendorPayments) {
      if (!inRange(p.date, from, to)) continue
      const b = bucketFor(apBuckets, p.vendor_name || "Unknown")
      b.payment += p.amount || 0
      b.tds     += p.tax_amount_withheld || 0
    }

    // Journals — only attributed when a line item explicitly tags a customer/vendor.
    for (const j of journals) {
      if (!inRange(j.journal_date, from, to)) continue
      for (const li of j.line_items ?? []) {
        const amt = li.debit_or_credit === "credit" ? -(li.amount || 0) : (li.amount || 0)
        if (li.customer_name) bucketFor(arBuckets, li.customer_name).journal += amt
        if (li.vendor_name)   bucketFor(apBuckets, li.vendor_name).journal += amt
      }
    }

    const toRows = (buckets: Record<string, EntityBucket>, side: "ar" | "ap") =>
      Object.entries(buckets)
        .map(([entity, b]) => ({
          entity, ...b,
          balance: side === "ar"
            ? b.invoiced - b.payment - b.creditDebitNote - b.tds + b.journal
            : b.invoiced - b.payment - b.creditDebitNote - b.tds + b.journal,
        }))
        .filter(r => r.invoiced || r.payment || r.creditDebitNote || r.journal || r.tds)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

    return NextResponse.json({
      receivables: toRows(arBuckets, "ar"),
      payables:    toRows(apBuckets, "ap"),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
