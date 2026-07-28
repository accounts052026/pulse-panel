import { NextResponse } from "next/server"
import { getInvoices, getBills } from "@/lib/zoho"
import { getNeon } from "@/lib/neon"

export const dynamic = "force-dynamic"

function isOverdue(due_date: string, balance: number) {
  return balance > 0 && new Date(due_date) < new Date()
}

async function getMapping(): Promise<Record<string, { canonical_name: string; side: string }>> {
  try {
    const sql = getNeon()
    await sql`
      CREATE TABLE IF NOT EXISTS entity_mapping (
        entity_name    TEXT PRIMARY KEY,
        canonical_name TEXT NOT NULL,
        side           TEXT NOT NULL,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const rows = await sql`SELECT entity_name, canonical_name, side FROM entity_mapping`
    const map: Record<string, { canonical_name: string; side: string }> = {}
    for (const r of rows as unknown as { entity_name: string; canonical_name: string; side: string }[]) {
      map[r.entity_name] = { canonical_name: r.canonical_name, side: r.side }
    }
    return map
  } catch {
    return {} // mapping is optional — dashboard still works with raw names if Neon is unreachable
  }
}

// Returns EVERY distinct entity that appears in Zoho invoices/bills — no top-N cutoff.
// Each row carries both the raw name (as it appears in Zoho) and, if mapped, the canonical name.
export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([getInvoices(), getBills(), getMapping()])

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
      const rawList = Object.entries(raw).map(([entity_name, v]) => ({
        entity_name,
        canonical_name: mapping[entity_name]?.canonical_name ?? entity_name,
        mapped: !!mapping[entity_name],
        total: v.total, overdue: v.overdue, count: v.count,
      })).sort((a, b) => b.total - a.total)

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
