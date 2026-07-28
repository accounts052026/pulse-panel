import { NextResponse } from "next/server"
import { getCachedInvoices as getInvoices, getCachedBills as getBills, getEntityMapping, canonical } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function isOverdue(due_date: string, balance: number) {
  return balance > 0 && new Date(due_date) < new Date()
}

// Returns EVERY distinct entity that appears in Zoho invoices/bills — no top-N cutoff.
// Each row carries both the raw name (as it appears in Zoho) and, if mapped, the canonical name.
export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([getInvoices(), getBills(), getEntityMapping()])

    const buildSide = (
      items: { balance: number; due_date: string }[],
      nameKey: "customer_name" | "vendor_name",
      side: "payable" | "receivable"
    ) => {
      const raw: Record<string, { total: number; overdue: number; count: number }> = {}
      for (const it of items as any[]) {
        const name = it[nameKey] || "Unknown"
        if (!raw[name]) raw[name] = { total: 0, overdue: 0, count: 0 }
        raw[name].total += it.balance || 0
        raw[name].count += 1
        if (isOverdue(it.due_date, it.balance)) raw[name].overdue += it.balance
      }

      // raw (unmapped) list — for the Entity Master editor
      const rawList = Object.entries(raw).map(([entity_name, v]) => {
        const canonical_name = canonical(entity_name, mapping)
        return {
          entity_name,
          canonical_name,
          // "mapped" means it actually resolves to something different from
          // the raw Zoho name. Previously this was `!!mapping[entity_name]`,
          // an exact-key hit only — so a mapping saved against a slightly
          // different form of the name showed the row as RAW even though it
          // was being applied. Deriving it from the resolved value keeps the
          // badge honest and consistent with what the dashboard groups by.
          mapped: canonical_name !== entity_name,
          total: v.total, overdue: v.overdue, count: v.count,
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

    const payables    = buildSide(bills as any[], "vendor_name", "payable")
    const receivables = buildSide(invoices as any[], "customer_name", "receivable")

    return NextResponse.json({ payables, receivables })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
