import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getEntityTotals, getEntityMapping, canonical,
  getEntityCategoryMap, getDerivedVendorCategories, getUnappliedByEntity,
  getNetPositions,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Returns EVERY distinct entity that appears in Zoho invoices/bills — no top-N cutoff.
// Each row carries both the raw name (as it appears in Zoho) and, if mapped, the canonical name.
//
// Totals are aggregated by Postgres (see getEntityTotals) rather than by
// pulling ~26k invoice/bill rows across the wire and reducing them in JS,
// which is what made this endpoint — and the three pages that depend on
// it — take many seconds to respond.
export async function GET() {
  try {
    const [invoices, bills, payableTotals, receivableTotals, mapping, savedCategories, derivedCategories, unappliedAp, unappliedAr] = await Promise.all([
      getInvoices(),
      getBills(),
      getEntityTotals("payable"),
      getEntityTotals("receivable"),
      getEntityMapping(),
      getEntityCategoryMap(),
      getDerivedVendorCategories(),
      getUnappliedByEntity("payable"),
      getUnappliedByEntity("receivable"),
    ])

    // Net position from Zoho's own contact balances — the same source the
    // dashboard, ageing and platforms tabs use, so every page reports the
    // identical figure and it ties to Zoho's Balance Summary reports.
    const EXCLUDED = new Set(["draft", "void", "voided"])
    const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())
    const [apNet, arNet] = await Promise.all([
      getNetPositions("payable", mapping, bills.filter(b => isLive(b.status)), "vendor_name"),
      getNetPositions("receivable", mapping, invoices.filter(i => isLive(i.status)), "customer_name"),
    ])
    const netBySide = { payable: apNet, receivable: arNet }

    const lookup = (map: Record<string, string>, name: string) =>
      map[name] ?? map[name.trim().toLowerCase()] ?? null

    const buildSide = (
      totals: { entity_name: string; total: number; overdue: number; count: number }[],
      side: "payable" | "receivable",
      unapplied: Record<string, number>,
    ) => {
      // raw (unmapped) list — for the Entity Master editor
      const rawList = totals.map(t => {
        const canonical_name = canonical(t.entity_name, mapping)
        const savedCategory = lookup(savedCategories, t.entity_name)
        const derivedCategory = lookup(derivedCategories, t.entity_name)
        return {
          entity_name: t.entity_name,
          canonical_name,
          // "mapped" means it actually resolves to something different from
          // the raw Zoho name, so the badge always agrees with what the
          // dashboard groups by.
          mapped: canonical_name !== t.entity_name,
          // category = what the user set; derivedCategory = inferred from the
          // expense account this party is most often booked against, shown as
          // a suggestion when nothing has been set by hand.
          category: savedCategory,
          derivedCategory,
          effectiveCategory: savedCategory ?? derivedCategory,
          total: t.total, overdue: t.overdue, count: t.count,
          advance: unapplied[t.entity_name] ?? 0,
        }
      }).sort((a, b) => b.total - a.total)

      // canonically-grouped list — straight from the shared net calculation
      const groupedList = netBySide[side].entities.map(e => ({
        name: e.name,
        total: e.outstanding,
        overdue: e.overdue,
        count: e.count,
        pct: e.outstanding > 0 ? Math.min(100, (e.overdue / e.outstanding) * 100) : 0,
      }))

      return { raw: rawList, grouped: groupedList, side }
    }

    return NextResponse.json({
      payables: buildSide(payableTotals, "payable", unappliedAp),
      receivables: buildSide(receivableTotals, "receivable", unappliedAr),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
