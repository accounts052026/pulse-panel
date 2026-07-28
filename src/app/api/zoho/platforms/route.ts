import { NextResponse } from "next/server"
import { getCachedInvoices as getInvoices, getCachedBills as getBills, getLastSyncedAt } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"

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

function matchPlatform(name: string): string {
  const lower = name.toLowerCase()
  for (const [platform, aliases] of Object.entries(PLATFORM_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return platform
  }
  return "Other"
}

function isOverdue(due_date: string, balance: number) {
  return balance > 0 && new Date(due_date) < new Date()
}

function byPlatform<T extends { balance: number; due_date: string }>(items: T[], nameKey: keyof T) {
  const map: Record<string, { total: number; overdue: number; count: number }> = {}
  for (const it of items) {
    if (!it.balance) continue
    const platform = matchPlatform(String(it[nameKey] ?? ""))
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
    const [invoices, bills] = await Promise.all([getInvoices(), getBills()])
    const receivablesByPlatform = byPlatform(invoices, "customer_name")
    const payablesByPlatform = byPlatform(bills, "vendor_name")
    return NextResponse.json({
      receivablesByPlatform,
      payablesByPlatform,
      asOf: (await getLastSyncedAt()) ?? new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
