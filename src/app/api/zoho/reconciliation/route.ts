import { NextRequest, NextResponse } from "next/server"
import { getNeon, rowsOf } from "@/lib/neon"
import {
  getEntityMapping, canonical, getLastSyncedAt,
  ensureCreditNoteDetailColumns, classifyCreditNote,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Platform settlement reconciliation.
//
// Mirrors how a platform payment advice actually works:
//   Gross Sales (invoices)
//     less Returns credit notes      (undelivered / damaged / short)
//     less BDPO credit notes         (post-sales brand discount / promo)
//     less Payments received in bank
//   = Net Receivable
//   Marketing & other bills less vendor payments = Net Payable
//   Net Settlement = Net Receivable - Net Payable
//
// Credit notes are split using the accounts their line items post to,
// captured by the enrichment pass in syncCreditNoteDetailsBatch.
function defaultFinancialYear() {
  const now = new Date()
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` }
}

interface Bucket {
  grossSales: number
  returnsCn: number
  bdpoCn: number
  otherCn: number
  receipts: number
  bills: number
  vendorPayments: number
  invoiceCount: number
}

const empty = (): Bucket => ({
  grossSales: 0, returnsCn: 0, bdpoCn: 0, otherCn: 0,
  receipts: 0, bills: 0, vendorPayments: 0, invoiceCount: 0,
})

const EXCLUDED = new Set(["draft", "void", "voided"])
const live = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())

export async function GET(req: NextRequest) {
  try {
    const fy = defaultFinancialYear()
    const from = req.nextUrl.searchParams.get("from") || fy.from
    const to   = req.nextUrl.searchParams.get("to")   || fy.to

    await ensureCreditNoteDetailColumns()
    const sqlF = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
    const mapping = await getEntityMapping()

    // Aggregated in Postgres per raw entity name, then folded into platform
    // groups here — same approach as getEntityTotals, so we never stream
    // tens of thousands of rows across the wire just to add them up.
    const agg = async (sql: string) =>
      rowsOf<{ name: string; amt: number; cnt: number }>(
        (await sqlF(sql, [from, to])) as unknown
      )

    const [invoices, receipts, bills, vendorPays] = await Promise.all([
      agg(`SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                  COALESCE(SUM(total),0)::float8 AS amt, COUNT(*)::int AS cnt
           FROM zoho_invoices
           WHERE date BETWEEN $1 AND $2 AND LOWER(COALESCE(status,'')) NOT IN ('draft','void','voided')
           GROUP BY 1`),
      agg(`SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                  COALESCE(SUM(amount),0)::float8 AS amt, COUNT(*)::int AS cnt
           FROM zoho_customerpayments WHERE date BETWEEN $1 AND $2 GROUP BY 1`),
      agg(`SELECT COALESCE(NULLIF(TRIM(vendor_name),''),'Unknown') AS name,
                  COALESCE(SUM(total),0)::float8 AS amt, COUNT(*)::int AS cnt
           FROM zoho_bills
           WHERE date BETWEEN $1 AND $2 AND LOWER(COALESCE(status,'')) NOT IN ('draft','void','voided')
           GROUP BY 1`),
      agg(`SELECT COALESCE(NULLIF(TRIM(vendor_name),''),'Unknown') AS name,
                  COALESCE(SUM(amount),0)::float8 AS amt, COUNT(*)::int AS cnt
           FROM zoho_vendorpayments WHERE date BETWEEN $1 AND $2 GROUP BY 1`),
    ])

    // Credit notes need their line accounts to classify, so they come back
    // per-note rather than pre-aggregated.
    const creditNotes = rowsOf<{ name: string; amt: number; line_accounts: string | null }>(
      (await sqlF(
        `SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                COALESCE(total,0)::float8 AS amt,
                line_accounts
         FROM zoho_creditnotes
         WHERE date BETWEEN $1 AND $2 AND LOWER(COALESCE(status,'')) NOT IN ('draft','void','voided')`,
        [from, to]
      )) as unknown
    )

    const buckets: Record<string, Bucket> = {}
    const at = (raw: string) => {
      const k = canonical(raw, mapping)
      return buckets[k] ?? (buckets[k] = empty())
    }

    for (const r of invoices)   { const b = at(r.name); b.grossSales += r.amt; b.invoiceCount += r.cnt }
    for (const r of receipts)   { at(r.name).receipts += r.amt }
    for (const r of bills)      { at(r.name).bills += r.amt }
    for (const r of vendorPays) { at(r.name).vendorPayments += r.amt }

    const accountsSeen = new Set<string>()
    let unclassifiedNotes = 0
    for (const cn of creditNotes) {
      let accounts: string[] = []
      try { accounts = cn.line_accounts ? JSON.parse(cn.line_accounts) : [] } catch { accounts = [] }
      accounts.forEach(a => accountsSeen.add(a))
      const kind = classifyCreditNote(accounts)
      const b = at(cn.name)
      if (kind === "bdpo") b.bdpoCn += cn.amt
      else if (kind === "returns") b.returnsCn += cn.amt
      else { b.otherCn += cn.amt; unclassifiedNotes++ }
    }

    const rows = Object.entries(buckets).map(([name, b]) => {
      const netReceivable = b.grossSales - b.returnsCn - b.bdpoCn - b.otherCn - b.receipts
      const netPayable    = b.bills - b.vendorPayments
      return {
        name, ...b,
        netSales: b.grossSales - b.returnsCn - b.bdpoCn - b.otherCn,
        netReceivable,
        netPayable,
        netSettlement: netReceivable - netPayable,
      }
    })
      .filter(r => r.grossSales || r.receipts || r.bills || r.vendorPayments || r.returnsCn || r.bdpoCn || r.otherCn)
      .sort((a, b) => b.grossSales - a.grossSales)

    // How complete the credit-note enrichment is, so the UI can warn when
    // the BDPO/returns split is still based on partial data.
    const enrich = rowsOf<{ total: number; done: number }>(
      (await sqlF(`SELECT COUNT(*)::int AS total,
                          COUNT(detail_synced_at)::int AS done
                   FROM zoho_creditnotes`)) as unknown
    )[0] ?? { total: 0, done: 0 }

    return NextResponse.json({
      rows,
      range: { from, to },
      creditNoteAccounts: Array.from(accountsSeen).sort(),
      enrichment: { total: enrich.total, done: enrich.done, pending: enrich.total - enrich.done, unclassifiedNotes },
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
