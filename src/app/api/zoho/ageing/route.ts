import { NextResponse } from "next/server"
import { getCachedInvoices as getInvoices, getCachedBills as getBills, getLastSyncedAt, getEntityMapping, canonical } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BUCKETS = ["0 - 30 Days", "31 - 60 Days", "61 - 90 Days", "91 - 120 Days", "> 120 Days"] as const

function bucketFor(days: number): typeof BUCKETS[number] {
  if (days <= 30) return "0 - 30 Days"
  if (days <= 60) return "31 - 60 Days"
  if (days <= 90) return "61 - 90 Days"
  if (days <= 120) return "91 - 120 Days"
  return "> 120 Days"
}

function entityAgeing<T extends { balance: number; due_date: string }>(items: T[], nameKey: keyof T, mapping: Record<string, string>) {
  const today = new Date()
  const map: Record<string, Record<string, number>> = {}
  for (const it of items) {
    if (!it.balance) continue
    const name = canonical(it[nameKey] as unknown as string, mapping)
    const days = Math.floor((today.getTime() - new Date(it.due_date).getTime()) / 86_400_000)
    const bucket = bucketFor(days)
    if (!map[name]) map[name] = Object.fromEntries(BUCKETS.map(b => [b, 0]))
    map[name][bucket] += it.balance
  }
  return Object.entries(map)
    .map(([name, buckets]) => ({ name, buckets, total: Object.values(buckets).reduce((s, v) => s + v, 0) }))
    .filter(r => r.total !== 0)
    .sort((a, b) => b.total - a.total)
}

export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([getInvoices(), getBills(), getEntityMapping()])
    return NextResponse.json({
      buckets: BUCKETS,
      payables: entityAgeing(bills, "vendor_name", mapping),
      receivables: entityAgeing(invoices, "customer_name", mapping),
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
