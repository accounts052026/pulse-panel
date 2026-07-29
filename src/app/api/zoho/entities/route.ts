import { NextResponse } from "next/server"
import {
  getEntityTotals, getEntityMapping, canonical,
  getEntityCategoryMap, getDerivedVendorCategories, getUnappliedByEntity,
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
    const [payableTotals, receivableTotals, mapping, savedCategories, derivedCategories, unappliedAp, unappliedAr] = await Promise.all([
      getEntityTotals("payable"),
      getEntityTotals("receivable"),
      getEntityMapping(),
      getEntityCategoryMap(),
      getDerivedVendorCategories(),
      getUnappliedByEntity("payable"),
      getUnappliedByEntity("receivable"),
    ])

    const lookup = (map: Record<string, string>, name: string) =>
      map[name] ?? map[name.trim().toLowerCase()] ?? null

    const buildSide = (
      totals: { entity_name: string; total: number; overdue: number; count: number }[],
      side: "payable" | "receivable",
      unapplied: Record<string, number>,
    ) => {
      // Advances are held against a legal entity but must offset the whole
      // platform they belong to, so they're rolled up to canonical names
      // before being applied.
      const advanceFor: Record<string, number> = {}
      for (const [rawName, amt] of Object.entries(unapplied)) {
        const key = canonical(rawName, mapping)
        advanceFor[key] = (advanceFor[key] ?? 0) + amt
      }
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
        .map(([name, v]) => {
          const advance = advanceFor[name] ?? 0
          // FIFO: an advance settles the oldest documents first, which are
          // by definition the overdue ones — so overdue absorbs the advance
          // before anything current does. Netting the total but not the
          // overdue is what produced impossible figures like "155% overdue".
          const netOverdue = Math.max(0, v.overdue - advance)
          const netTotal = v.total - advance
          return {
            name,
            grossTotal: v.total,
            grossOverdue: v.overdue,
            advance,
            unabsorbedAdvance: Math.max(0, advance - v.total),
            total: netTotal,
            overdue: netOverdue,
            count: v.count,
            pct: netTotal > 0 ? (netOverdue / netTotal) * 100 : 0,
          }
        })
        .sort((a, b) => b.total - a.total)

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
