import { NextResponse } from "next/server"
import {
  getCachedBankAccounts as getBankAccounts,
  getCachedCustomerPayments as getCustomerPayments,
  getCachedVendorPayments as getVendorPayments,
  getCachedExpenses as getExpenses,
  getLastSyncedAt,
} from "@/lib/zoho-store"

export const dynamic = "force-dynamic"

function monthKey(d: string) { return d?.slice(0, 7) ?? "Unknown" }

export async function GET() {
  try {
    const [bankAccounts, customerPayments, vendorPayments, expenses] = await Promise.all([
      getBankAccounts(), getCustomerPayments(), getVendorPayments(), getExpenses(),
    ])

    const totalBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0)

    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const trend = months.map(m => {
      const inflow  = customerPayments.filter(p => monthKey(p.date) === m).reduce((s, p) => s + (p.amount || 0), 0)
      const outflow = vendorPayments.filter(p => monthKey(p.date) === m).reduce((s, p) => s + (p.amount || 0), 0)
                    + expenses.filter(e => monthKey(e.date) === m).reduce((s, e) => s + (e.total || 0), 0)
      return { month: m, inflow, outflow, net: inflow - outflow }
    })

    const thisMonthKey = months[months.length - 1]
    const inflowThisMonth  = trend[trend.length - 1]?.inflow ?? 0
    const outflowThisMonth = trend[trend.length - 1]?.outflow ?? 0

    return NextResponse.json({
      totalBalance,
      accounts: bankAccounts.filter(a => a.account_name).sort((a, b) => b.balance - a.balance),
      trend,
      inflowThisMonth,
      outflowThisMonth,
      netThisMonth: inflowThisMonth - outflowThisMonth,
      asOf: (await getLastSyncedAt()) ?? now.toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
