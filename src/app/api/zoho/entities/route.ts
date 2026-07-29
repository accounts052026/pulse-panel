import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getEntityTotals, getEntityMapping, canonical,
  getEntityCategoryMap, getDerivedVendorCategories, getUnappliedByEntity,
  computeNetAgeing,
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

    // The grouped (canonical) figures come from the SAME shared calculation
    // the dashboard and ageing tabs use, so all three agree by construction.
    const EXCLUDED = new Set(["draft", "void", "voided"])
    const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())
    const netBySide = {
      payable:    computeNetAgeing(bills.filter(b => isLive(b.status)), "vendor_name", mapping, unappliedAp),
      receivable: computeNetAgeing(invoices.filter(i => isLive(i.status)), "customer_name", mapping, unappliedAr),
    }

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

      // canonically-grouped list — straight from the shared calculation
      const groupedList = netBySide[side].entities.map(e => ({
        name: e.name,
        grossTotal: e.grossTotal,
        grossOverdue: e.grossOverdue,
        advance: e.advance,
        unabsorbedAdvance: e.unabsorbedAdvance,
        total: e.total,
        overdue: e.overdue,
        count: e.count,
        pct: e.total > 0 ? Math.min(100, (e.overdue / e.total) * 100) : 0,
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
