import { NextResponse } from "next/server"
import { getCachedInvoices as getInvoices, getCachedBills as getBills, getLastSyncedAt, getEntityMapping, canonical } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
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

function byPlatform<T extends { balance: number; due_date: string }>(items: T[], nameKey: keyof T, mapping: Record<string, string>) {
  const map: Record<string, { total: number; overdue: number; count: number }> = {}
  for (const it of items) {
    if (!it.balance) continue
    const platform = matchPlatform(String(it[nameKey] ?? ""), mapping)
    if (!map[platform]) map[platform] = { total: 0, overdue: 0, count: 0 }
    map[platform].total += it.balance
    map[platform].count += 1
    if (isOverdue(it.due_date, it.balance)) map[platform].overdue += it.balance
  }
  return Object.entries(map)
    .map(([name, v]) => ({ name, total: v.total, overdue: v.overdue, count: v.count, pct: v.total ? (v.overdue / v.total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
}

export async function GET() {
  try {
    const [invoices, bills, mapping] = await Promise.all([getInvoices(), getBills(), getEntityMapping()])
    const receivablesByPlatform = byPlatform(invoices, "customer_name", mapping)
    const payablesByPlatform = byPlatform(bills, "vendor_name", mapping)

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
