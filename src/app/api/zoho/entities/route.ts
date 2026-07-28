import { NextResponse } from "next/server"
import {
  getEntityTotals, getEntityMapping, canonical,
  getEntityCategoryMap, getDerivedVendorCategories,
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
    const [payableTotals, receivableTotals, mapping, savedCategories, derivedCategories] = await Promise.all([
      getEntityTotals("payable"),
      getEntityTotals("receivable"),
      getEntityMapping(),
      getEntityCategoryMap(),
      getDerivedVendorCategories(),
    ])

    const lookup = (map: Record<string, string>, name: string) =>
      map[name] ?? map[name.trim().toLowerCase()] ?? null

    const buildSide = (
      totals: { entity_name: string; total: number; overdue: number; count: number }[],
      side: "payable" | "receivable"
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
        }
      }).sort((a, b) => b.total - a.total)

      // canonically-grouped list — for dashboard display
      const grouped: Record<string, { total: number; overdue: number; count: number }> = {}
      for (const r of rawList) {
        const key = r.canonical_name
        if (!grouped[key]) grouped[key] = { total: 0, overdue: 0, count: 0 }
        grouped[key].total += r.total
        grouped[key].overdue += r.overdue
        grouped[key].count += r.count
      }
      const groupedList = Object.entries(grouped)
        .map(([name, v]) => ({ name, ...v, pct: v.total ? (v.overdue / v.total) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)

      return { raw: rawList, grouped: groupedList, side }
    }

    return NextResponse.json({
      payables: buildSide(payableTotals, "payable"),
      receivables: buildSide(receivableTotals, "receivable"),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
