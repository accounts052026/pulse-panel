import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getLastSyncedAt, getEntityMapping, canonical, getUnappliedByEntity,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

const BUCKETS = ["0 - 30 Days", "31 - 60 Days", "61 - 90 Days", "91 - 120 Days", "> 120 Days"] as const

function bucketFor(days: number): typeof BUCKETS[number] {
  if (days <= 30) return "0 - 30 Days"
  if (days <= 60) return "31 - 60 Days"
  if (days <= 90) return "61 - 90 Days"
  if (days <= 120) return "91 - 120 Days"
  return "> 120 Days"
}

function entityAgeing<T extends { balance: number; due_date: string }>(
  items: T[],
  nameKey: keyof T,
  mapping: Record<string, string>,
  unapplied: Record<string, number>,
) {
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

  // Roll unapplied advances up to the same canonical name the ageing is
  // grouped by, so an advance recorded against one legal entity offsets
  // that whole platform's ageing.
  const advanceFor: Record<string, number> = {}
  for (const [rawName, amt] of Object.entries(unapplied)) {
    const name = canonical(rawName, mapping)
    advanceFor[name] = (advanceFor[name] ?? 0) + amt
  }

  return Object.entries(map)
    .map(([name, gross]) => {
      const grossTotal = Object.values(gross).reduce((s, v) => s + v, 0)
      const advance = advanceFor[name] ?? 0

      // Apply the advance FIFO — oldest bucket first, since the oldest
      // document is the one that would settle first. Whatever the advance
      // can't absorb stays as a credit balance on the entity.
      const net = { ...gross }
      let left = advance
      for (let i = BUCKETS.length - 1; i >= 0 && left > 0; i--) {
        const b = BUCKETS[i]
        const applied = Math.min(net[b], left)
        net[b] -= applied
        left -= applied
      }

      return {
        name,
        buckets: net,
        grossBuckets: gross,
        total: Object.values(net).reduce((s, v) => s + v, 0),
        grossTotal,
        advance,
        unabsorbedAdvance: left,
      }
    })
    .filter(r => r.grossTotal !== 0 || r.advance !== 0)
    .sort((a, b) => b.total - a.total)
}

export async function GET() {
  try {
    const [invoices, bills, mapping, unappliedAp, unappliedAr] = await Promise.all([
      getInvoices(), getBills(), getEntityMapping(),
      getUnappliedByEntity("payable"), getUnappliedByEntity("receivable"),
    ])
    return NextResponse.json({
      buckets: BUCKETS,
      payables: entityAgeing(bills, "vendor_name", mapping, unappliedAp),
      receivables: entityAgeing(invoices, "customer_name", mapping, unappliedAr),
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
