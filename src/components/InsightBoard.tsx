"use client"
import { calcInsightBoard, fmt, type InsightRow } from "@/lib/calculations"
import type { Transaction } from "@/lib/supabase"
import { PLATFORMS } from "@/lib/platforms"

interface Props { transactions: Transaction[] }

const AR_ROWS: { key: keyof InsightRow; label: string; bold?: boolean; indent?: boolean }[] = [
  { key: "ar_invoice",   label: "Invoice (Gross Sales)"       },
  { key: "ar_returns",   label: "(-) Returns & Credit Notes",  indent: true },
  { key: "ar_net_sales", label: "Net Sales",                   bold: true   },
  { key: "ar_payment",   label: "(-) Payment Received",        indent: true },
  { key: "ar1",          label: "AR-1 (Net Sales − Payment)",  bold: true   },
  { key: "ar_tds",       label: "(-) TDS Deducted",            indent: true },
  { key: "ar2",          label: "AR-2 (After TDS)",            bold: true   },
  { key: "ar_bfd",       label: "(-) Brand Funded Discounts",  indent: true },
  { key: "ar3",          label: "AR-3 (After BFD)",            bold: true   },
  { key: "ar_adj",       label: "(-) Other Adjustments",       indent: true },
  { key: "ar4",          label: "AR-4  FINAL RECEIVABLE",      bold: true   },
]

const AP_ROWS: { key: keyof InsightRow; label: string; bold?: boolean; indent?: boolean }[] = [
  { key: "ap_invoice",    label: "Bills Received (AP Invoice)" },
  { key: "ap_payment",    label: "(-) Payment Made",            indent: true },
  { key: "ap1",           label: "AP-1 (Net Payable)",          bold: true   },
  { key: "ap_debit_note", label: "(-) Vendor Credits",          indent: true },
  { key: "ap2",           label: "AP-2 (After Credits)",        bold: true   },
  { key: "ap_tds",        label: "(-) TDS on AP",               indent: true },
  { key: "ap3",           label: "AP-3 (After TDS)",            bold: true   },
  { key: "ap_adj",        label: "(-) Other Adjustments",       indent: true },
  { key: "ap4",           label: "AP-4  FINAL PAYABLE",         bold: true   },
]

export default function InsightBoard({ transactions }: Props) {
  const platforms = PLATFORMS.slice(0, -1) as string[]
  const rows      = calcInsightBoard(transactions, platforms)
  const total     = (key: keyof InsightRow) => rows.reduce((s, r) => s + (r[key] as number), 0)

  const Cell = ({ v, bold }: { v: number; bold?: boolean }) => (
    <td className={`px-4 py-2 text-right text-sm tabular-nums ${bold ? "font-semibold" : ""} ${v < 0 ? "text-rose-600" : ""}`}>
      {fmt(v)}
    </td>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
      <div className="px-4 pt-4 pb-2 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-lg">InsightBoard — AR / AP / Net</h2>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-4 py-2 text-left font-medium text-slate-600 w-72">Particulars</th>
            {platforms.map((p) => <th key={p} className="px-4 py-2 text-right font-medium text-slate-600">{p}</th>)}
            <th className="px-4 py-2 text-right font-medium text-slate-800">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-emerald-50">
            <td colSpan={platforms.length + 2} className="px-4 py-1.5 font-semibold text-emerald-800 text-xs uppercase tracking-wide">
              ◆ Accounts Receivable (AR)
            </td>
          </tr>
          {AR_ROWS.map(({ key, label, bold, indent }) => (
            <tr key={key} className={bold ? "bg-emerald-50/60" : "hover:bg-slate-50"}>
              <td className={`px-4 py-2 ${bold ? "font-semibold text-slate-800" : "text-slate-600"} ${indent ? "pl-8 text-slate-500" : ""}`}>
                {label}
              </td>
              {rows.map((r) => <Cell key={r.platform} v={r[key] as number} bold={bold} />)}
              <Cell v={total(key)} bold={bold} />
            </tr>
          ))}

          <tr className="bg-rose-50">
            <td colSpan={platforms.length + 2} className="px-4 py-1.5 font-semibold text-rose-800 text-xs uppercase tracking-wide">
              ◆ Accounts Payable (AP)
            </td>
          </tr>
          {AP_ROWS.map(({ key, label, bold, indent }) => (
            <tr key={key} className={bold ? "bg-rose-50/60" : "hover:bg-slate-50"}>
              <td className={`px-4 py-2 ${bold ? "font-semibold text-slate-800" : "text-slate-600"} ${indent ? "pl-8 text-slate-500" : ""}`}>
                {label}
              </td>
              {rows.map((r) => <Cell key={r.platform} v={r[key] as number} bold={bold} />)}
              <Cell v={total(key)} bold={bold} />
            </tr>
          ))}

          <tr className="bg-indigo-50 border-t-2 border-indigo-200">
            <td className="px-4 py-3 font-bold text-indigo-900">NET CASH INFLOW / (OUTFLOW)</td>
            {rows.map((r) => (
              <td key={r.platform} className={`px-4 py-3 text-right font-bold tabular-nums text-lg ${r.net_cash < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                {fmt(r.net_cash)}
              </td>
            ))}
            <td className={`px-4 py-3 text-right font-bold tabular-nums text-lg ${total("net_cash") < 0 ? "text-rose-600" : "text-indigo-700"}`}>
              {fmt(total("net_cash"))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
