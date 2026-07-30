import { NextRequest, NextResponse } from "next/server"
import { getNeon, rowsOf } from "@/lib/neon"
import { getEntityMapping, canonical, getLastSyncedAt } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Platform-wise movement for the period. Deliberately just four lines —
// invoices raised, credit notes issued, payments received, journals — plus
// the net. Zoho Books itself is the place to drill into document detail;
// this is here to answer "what moved, and what's left" at a glance.
function defaultFinancialYear() {
  const now = new Date()
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` }
}

interface Bucket {
  invoiced: number
  creditNotes: number
  payments: number
  journals: number
}
const empty = (): Bucket => ({ invoiced: 0, creditNotes: 0, payments: 0, journals: 0 })

export async function GET(req: NextRequest) {
  try {
    const fy = defaultFinancialYear()
    const from = req.nextUrl.searchParams.get("from") || fy.from
    const to   = req.nextUrl.searchParams.get("to")   || fy.to

    const sqlF = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
    const mapping = await getEntityMapping()

    const agg = async (sql: string) =>
      rowsOf<{ name: string; amt: number }>((await sqlF(sql, [from, to])) as unknown)

    const [invoices, creditNotes, payments] = await Promise.all([
      agg(`SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                  COALESCE(SUM(total),0)::float8 AS amt
           FROM zoho_invoices
           WHERE date BETWEEN $1 AND $2
             AND LOWER(COALESCE(status,'')) NOT IN ('draft','void','voided')
           GROUP BY 1`),
      agg(`SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                  COALESCE(SUM(total),0)::float8 AS amt
           FROM zoho_creditnotes
           WHERE date BETWEEN $1 AND $2
             AND LOWER(COALESCE(status,'')) NOT IN ('draft','void','voided')
           GROUP BY 1`),
      agg(`SELECT COALESCE(NULLIF(TRIM(customer_name),''),'Unknown') AS name,
                  COALESCE(SUM(amount),0)::float8 AS amt
           FROM zoho_customerpayments
           WHERE date BETWEEN $1 AND $2
           GROUP BY 1`),
    ])

    const buckets: Record<string, Bucket> = {}
    const at = (raw: string) => {
      const k = canonical(raw, mapping)
      return buckets[k] ?? (buckets[k] = empty())
    }

    for (const r of invoices)    at(r.name).invoiced    += r.amt
    for (const r of creditNotes) at(r.name).creditNotes += r.amt
    for (const r of payments)    at(r.name).payments    += r.amt

    // Journals are only attributable where Zoho tags a party on the line.
    const journals = rowsOf<{ journal_date: string; line_items: unknown }>(
      (await sqlF(
        `SELECT journal_date, line_items FROM zoho_journals WHERE journal_date BETWEEN $1 AND $2`,
        [from, to]
      )) as unknown
    )
    for (const j of journals) {
      let items: { customer_name?: string; vendor_name?: string; amount?: number; debit_or_credit?: string }[] = []
      try {
        items = typeof j.line_items === "string" ? JSON.parse(j.line_items) : (j.line_items as typeof items) ?? []
      } catch { items = [] }
      for (const li of items) {
        const party = li.customer_name || li.vendor_name
        if (!party) continue
        const amt = li.debit_or_credit === "credit" ? -(li.amount || 0) : (li.amount || 0)
        at(party).journals += amt
      }
    }

    const rows = Object.entries(buckets)
      .map(([name, b]) => ({
        name, ...b,
        // What the platform still owes for this period's activity.
        net: b.invoiced - b.creditNotes - b.payments + b.journals,
      }))
      .filter(r => r.invoiced || r.creditNotes || r.payments || r.journals)
      .sort((a, b) => b.invoiced - a.invoiced)

    return NextResponse.json({
      rows,
      range: { from, to },
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
