import { NextResponse } from "next/server"
import { getNeon } from "@/lib/neon"
import { getCachedInvoices, getCachedBills } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"

// Temporary diagnostic route — inspect raw cached rows/types.
// Safe to delete once the numeric-parsing issue is confirmed fixed.
export async function GET() {
  try {
    const sql = getNeon()
    const bills = await sql`SELECT bill_id, vendor_name, total, balance, status, pg_typeof(total) AS total_type, pg_typeof(balance) AS balance_type FROM zoho_bills LIMIT 3`
    const invoices = await sql`SELECT invoice_id, customer_name, total, balance, status, pg_typeof(total) AS total_type, pg_typeof(balance) AS balance_type FROM zoho_invoices LIMIT 3`
    const billStats = await sql`SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE balance <> 0) AS nonzero_balance, COUNT(*) FILTER (WHERE total <> 0) AS nonzero_total FROM zoho_bills`
    const invoiceStats = await sql`SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE balance <> 0) AS nonzero_balance, COUNT(*) FILTER (WHERE total <> 0) AS nonzero_total FROM zoho_invoices`

    let viaHelperInvoices: unknown = null, viaHelperBills: unknown = null, helperError: string | null = null
    try {
      const inv = await getCachedInvoices()
      const bil = await getCachedBills()
      viaHelperInvoices = { length: inv.length, sample: inv.slice(0, 2) }
      viaHelperBills = { length: bil.length, sample: bil.slice(0, 2) }
    } catch (e: unknown) {
      helperError = e instanceof Error ? e.message : String(e)
    }

    // Same 8-column query text as getCachedInvoices, but run directly here —
    // isolates whether it's the query itself or the wrapping function.
    const inlineFullCols = await sql`SELECT invoice_id, invoice_number, customer_name, date, due_date, total, balance, status FROM zoho_invoices`
    const inlineFullColsLength = (inlineFullCols as unknown as any[]).length

    return NextResponse.json({ bills, invoices, billStats, invoiceStats, viaHelperInvoices, viaHelperBills, helperError, inlineFullColsLength })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
