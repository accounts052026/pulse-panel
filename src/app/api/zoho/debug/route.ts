import { NextResponse } from "next/server"
import { getNeon } from "@/lib/neon"

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
    return NextResponse.json({ bills, invoices, billStats, invoiceStats })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
