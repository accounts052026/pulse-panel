import { NextRequest, NextResponse } from "next/server"
import { getNeon } from "@/lib/neon"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const view     = searchParams.get("view") || "monthly"   // monthly | kpis | reconciliation | fy
  const platform = searchParams.get("platform")
  const from     = searchParams.get("from")
  const to       = searchParams.get("to")

  try {
    const sql = getNeon()
    let rows

    if (view === "monthly") {
      rows = await sql`
        SELECT * FROM v_monthly_platform
        WHERE 1=1
          ${platform && platform !== "All" ? sql`AND platform = ${platform}` : sql``}
          ${from ? sql`AND month >= ${from.slice(0,7)}` : sql``}
          ${to   ? sql`AND month <= ${to.slice(0,7)}`   : sql``}
        ORDER BY month DESC, platform
      `

    } else if (view === "kpis") {
      rows = await sql`
        SELECT * FROM v_platform_kpis
        ${platform && platform !== "All" ? sql`WHERE platform = ${platform}` : sql``}
      `

    } else if (view === "reconciliation") {
      rows = await sql`
        SELECT * FROM v_reconciliation
        WHERE 1=1
          ${platform && platform !== "All" ? sql`AND platform = ${platform}` : sql``}
          ${from ? sql`AND invoice_date >= ${from}::date` : sql``}
          ${to   ? sql`AND invoice_date <= ${to}::date`   : sql``}
        LIMIT 5000
      `

    } else if (view === "fy") {
      rows = await sql`
        SELECT * FROM v_fy_summary
        ${platform && platform !== "All" ? sql`WHERE platform = ${platform}` : sql``}
      `

    } else if (view === "raw") {
      // Direct query on Neon's pp_transactions for heavy filtering
      const type = searchParams.get("type")
      rows = await sql`
        SELECT
          date, platform, entity, type,
          document_no, invoice_no, item_name,
          qty, rate, amount, total,
          cgst, sgst, igst, tds, status
        FROM pp_transactions
        WHERE 1=1
          ${platform && platform !== "All" ? sql`AND platform = ${platform}` : sql``}
          ${type     ? sql`AND type = ${type}`           : sql``}
          ${from     ? sql`AND date >= ${from}::date`    : sql``}
          ${to       ? sql`AND date <= ${to}::date`      : sql``}
        ORDER BY date DESC
        LIMIT 10000
      `
    } else {
      return NextResponse.json({ error: "Unknown view" }, { status: 400 })
    }

    return NextResponse.json(rows)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
