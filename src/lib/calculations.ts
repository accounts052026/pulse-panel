import type { Transaction } from "./supabase"

export interface InsightRow {
  platform: string
  ar_invoice: number
  ar_returns: number
  ar_net_sales: number
  ar_payment: number
  ar1: number
  ar_tds: number
  ar2: number
  ar_bfd: number
  ar3: number
  ar_adj: number
  ar4: number
  ap_invoice: number
  ap_payment: number
  ap1: number
  ap_debit_note: number
  ap2: number
  ap_tds: number
  ap3: number
  ap_adj: number
  ap4: number
  net_cash: number
}

export function calcInsightBoard(txs: Transaction[], platforms: string[]): InsightRow[] {
  return platforms.map((platform) => {
    const p = txs.filter((t) => t.platform === platform)

    const si     = sum(p, "sales_invoice",    "amount")
    const cn     = sum(p, "credit_note",      "amount")
    const pr     = sum(p, "payment_received", "amount")
    const tds_ar = p.filter(t => t.type === "payment_received").reduce((s, t) => s + (t.tds ?? 0), 0)
    const bfd    = p.filter(t => t.type === "credit_note" && /bfd|brand.funded/i.test(t.description ?? "")).reduce((s, t) => s + t.amount, 0)

    const net_sales = si - cn
    const ar1 = net_sales - pr
    const ar2 = ar1 - tds_ar
    const ar3 = ar2 - bfd
    const ar4 = ar3

    const bi     = sum(p, "bill_received", "amount")
    const pm     = sum(p, "payment_made",  "amount")
    const vc     = sum(p, "vendor_credit", "amount")
    const tds_ap = p.filter(t => t.type === "payment_made").reduce((s, t) => s + (t.tds ?? 0), 0)

    const ap1 = bi - pm
    const ap2 = ap1 - vc
    const ap3 = ap2 - tds_ap
    const ap4 = -ap3

    return {
      platform,
      ar_invoice: si, ar_returns: cn, ar_net_sales: net_sales,
      ar_payment: pr, ar1, ar_tds: tds_ar, ar2, ar_bfd: bfd, ar3, ar_adj: 0, ar4,
      ap_invoice: bi, ap_payment: pm, ap1, ap_debit_note: vc, ap2,
      ap_tds: tds_ap, ap3, ap_adj: 0, ap4,
      net_cash: ar4 + ap4,
    }
  })
}

function sum(txs: Transaction[], type: string, field: keyof Transaction): number {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t[field] ?? 0), 0)
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)
}
