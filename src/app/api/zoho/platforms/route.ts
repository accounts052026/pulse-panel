import { NextResponse } from "next/server"
import {
  getCachedInvoices as getInvoices, getCachedBills as getBills,
  getLastSyncedAt, getEntityMapping, canonical, getNetPositions,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Zoho itself has no "platform" field on invoices/bills — CURRYiT sells and
// pays through these marketplaces under a mix of legal-entity names (e.g.
// Blinkit's payouts arrive from "Moonstone Ventures"/"Asvah Retail", Swiggy's
// from "Scootsy Logistics"/"PJTJ Technologies", etc — the same mapping used
// on the Google-Sheets-driven root dashboard). We match customer/vendor
// names against those known aliases to group Zoho AR/AP by platform.
const PLATFORM_ALIASES: Record<string, string[]> = {
  "Blinkit":   ["blinkit", "moonstone ventures", "asvah retail", "blink commerce"],
  "Swiggy":    ["swiggy", "scootsy logistics", "pjtj technologies", "moksh enterprises", "cloudstore retail", "cloudkart ventures", "jupiter kart"],
  "Zepto":     ["zepto", "kiranakart"],
  "Amazon":    ["amazon"],
  "BigBasket": ["bigbasket", "big basket", "innovative retail concepts", "natures basket"],
  "Flipkart":  ["flipkart"],
  "Zomato":    ["zomato"],
  "Shopify (D2C)": ["shopify"],
}

// Resolution order matters: the user's OWN saved mapping wins, because
// that's the whole point of Entity Master — they decide which legal entity
// belongs to which platform. The built-in alias list is only a fallback for
// entities nobody has mapped yet, so the page is useful before any mapping
// work is done without ever overriding an explicit decision.
function matchPlatform(rawName: string, mapping: Record<string, string>): string {
  const mapped = canonical(rawName, mapping)
  if (mapped !== (rawName ?? "").trim()) return mapped // explicitly mapped by the user

  const lower = (rawName ?? "").toLowerCase()
  for (const [platform, aliases] of Object.entries(PLATFORM_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return platform
  }
  return mapped || "Other"
}

function isOverdue(due_date: string, balance: number) {
  return balance > 0 && new Date(due_date) < new Date()
}

function byPlatform<T extends { balance: number; due_date: string }>(
  items: T[], nameKey: keyof T, mapping: Record<string, string>, unapplied: Record<string, number>
) {
  const map: Record<string, { total: number; overdue: number; count: number }> = {}
  for (const it of items) {
    if (!it.balance) continue
    const platform = matchPlatform(String(it[nameKey] ?? ""), mapping)
    if (!map[platform]) map[platform] = { total: 0, overdue: 0, count: 0 }
    map[platform].total += it.balance
    map[platform].count += 1
    if (isOverdue(it.due_date, it.balance)) map[platform].overdue += it.balance
  }

  // Advances roll up to the same platform grouping before being applied.
  const advanceFor: Record<string, number> = {}
  for (const [rawName, amt] of Object.entries(unapplied)) {
    const p = matchPlatform(rawName, mapping)
    advanceFor[p] = (advanceFor[p] ?? 0) + amt
  }

  return Object.entries(map)
    .map(([name, v]) => {
      const advance = advanceFor[name] ?? 0
      // FIFO — the advance clears the oldest (overdue) balances first.
      const overdue = Math.max(0, v.overdue - advance)
      const total = v.total - advance
      return {
        name, total, overdue, count: v.count,
        grossTotal: v.total, grossOverdue: v.overdue, advance,
        pct: total > 0 ? Math.min(100, (overdue / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([
      getInvoices(), getBills(), getEntityMapping(),
    ])

    // Same net position source as every other page — platform totals now
    // tie to Payables/Receivables/Ageing and to Zoho itself.
    const EXCLUDED = new Set(["draft", "void", "voided"])
    const isLive = (s?: string) => !EXCLUDED.has((s ?? "").toLowerCase())
    const [arNet, apNet] = await Promise.all([
      getNetPositions("receivable", mapping, invoices.filter(i => isLive(i.status)), "customer_name"),
      getNetPositions("payable", mapping, bills.filter(b => isLive(b.status)), "vendor_name"),
    ])

    const toRows = (net: typeof arNet) => net.entities
      .map(e => ({
        name: e.name, total: e.outstanding, overdue: e.overdue, count: e.count,
        pct: e.outstanding > 0 ? Math.min(100, (e.overdue / e.outstanding) * 100) : 0,
      }))
      .filter(r => r.total !== 0)

    const receivablesByPlatform = toRows(arNet)
    const payablesByPlatform = toRows(apNet)

    // Combined view — every platform appearing on either side, so
    // receivables and payables can be compared in one window.
    const names = Array.from(new Set([...receivablesByPlatform.map(r => r.name), ...payablesByPlatform.map(p => p.name)]))
    const combined = names.map(name => {
      const r = receivablesByPlatform.find(x => x.name === name)
      const p = payablesByPlatform.find(x => x.name === name)
      const receivable = r?.total ?? 0
      const payable = p?.total ?? 0
      return {
        name,
        receivable, receivableOverdue: r?.overdue ?? 0, receivableCount: r?.count ?? 0,
        payable, payableOverdue: p?.overdue ?? 0, payableCount: p?.count ?? 0,
        net: receivable - payable,
      }
    }).sort((a, b) => (b.receivable + b.payable) - (a.receivable + a.payable))

    return NextResponse.json({
      receivablesByPlatform,
      payablesByPlatform,
      combined,
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
