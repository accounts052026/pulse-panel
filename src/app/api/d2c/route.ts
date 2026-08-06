import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// D2C customer statement — "Copy of Sheet9" of the D2C_Customer_Statement_ book.
const SHEET_ID = "1UTenRD19ExekwMAluHDOOx7Un73OPLqbNA5Zr8Oac_A"
const GID = "1896346192"
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ",") { row.push(cur.trim()); cur = "" }
      else if (ch === "\n") { row.push(cur.trim()); rows.push(row); row = []; cur = "" }
      else if (ch === "\r") { /* skip */ }
      else cur += ch
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur.trim()); rows.push(row) }
  return rows
}

function num(s: string | undefined): number {
  if (!s) return 0
  const clean = s.replace(/[₹,\s"]/g, "").replace(/\(([^)]+)\)/, "-$1")
  const v = parseFloat(clean)
  return isNaN(v) ? 0 : v
}

// Sheet dates look like "18-07-26" (dd-mm-yy).
function parseDate(s: string): string | null {
  if (!s) return null
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (m) {
    const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return `${yy}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  return null
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not read the sheet (HTTP ${res.status}). It must be shared as "Anyone with the link — Viewer".` },
        { status: 502 }
      )
    }
    const rows = parseCSV(await res.text())

    // Locate the header row — the one naming the money columns. The row
    // above it carries the gateway group labels (Razorpay, Gokwik-easebuzz,
    // Gokwik-twid, SR COD...), which is how repeated "Amount"/"Fee"/"Tax"
    // headers are disambiguated.
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const joined = rows[i].join("|").toLowerCase()
      if (joined.includes("document no") || (joined.includes("invoice") && joined.includes("credits"))) {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) {
      return NextResponse.json({ error: "Could not find the header row in the sheet." }, { status: 422 })
    }

    const header = rows[headerIdx].map(h => h.toLowerCase().trim())
    const groupRow = headerIdx > 0 ? rows[headerIdx - 1] : []

    const findCol = (...names: string[]) =>
      header.findIndex(h => names.some(nm => h === nm || h.includes(nm)))

    const colDate     = findCol("date")
    const colDoc      = findCol("document no")
    const colInvoice  = header.findIndex(h => h === "invoice" || h.startsWith("invoice"))
    const colCredits  = findCol("credits")
    const colNet      = findCol("net invoice")

    // Customer name and status sit in unlabelled columns between Document No.
    // and Invoice, so they're located positionally within that span.
    const colCustomer = colDoc >= 0 ? colDoc + 1 : 4
    let colStatus = -1
    for (let c = colDoc + 1; c < colInvoice && c < header.length; c++) {
      const sample = rows.slice(headerIdx + 1, headerIdx + 60).map(r => (r[c] ?? "").toLowerCase())
      if (sample.some(v => v === "paid" || v === "pending" || v === "voided")) { colStatus = c; break }
    }

    // Gateway groups: walk the group row, carrying the last non-empty label
    // forward across its columns.
    const gatewayOf: (string | null)[] = []
    let currentGroup: string | null = null
    for (let c = 0; c < header.length; c++) {
      const g = (groupRow[c] ?? "").trim()
      if (g) currentGroup = g
      gatewayOf[c] = currentGroup
    }

    interface GW { name: string; amount: number; fee: number; tax: number; credit: number }
    const gateways: Record<string, GW> = {}
    const gwCols: { col: number; gw: string; field: keyof GW }[] = []
    for (let c = 0; c < header.length; c++) {
      const h = header[c]
      const grp = gatewayOf[c]
      if (!grp) continue
      const g = grp.toLowerCase()
      const isGateway = /razorpay|easebuzz|twid|gokwik|gowik|sr c|cod|shiprocket/.test(g)
      if (!isGateway) continue
      let field: keyof GW | null = null
      if (h.includes("amount")) field = "amount"
      else if (h.includes("fee")) field = "fee"
      else if (h.includes("tax")) field = "tax"
      else if (h.includes("credit")) field = "credit"
      if (!field) continue
      if (!gateways[grp]) gateways[grp] = { name: grp, amount: 0, fee: 0, tax: 0, credit: 0 }
      gwCols.push({ col: c, gw: grp, field })
    }

    let invoiced = 0, credits = 0, netInvoice = 0
    let paid = 0, pending = 0, voided = 0
    let paidValue = 0, pendingValue = 0
    const byMonth: Record<string, { invoiced: number; net: number; orders: number }> = {}
    const orders: { date: string; doc: string; customer: string; status: string; invoice: number; net: number }[] = []

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.length < 3) continue
      const doc = (r[colDoc] ?? "").trim()
      const iso = parseDate(r[colDate] ?? "")
      if (!doc && !iso) continue

      const status = colStatus >= 0 ? (r[colStatus] ?? "").toLowerCase().trim() : ""
      const inv = num(r[colInvoice])
      const cr = colCredits >= 0 ? num(r[colCredits]) : 0
      const net = colNet >= 0 ? num(r[colNet]) : inv - cr
      if (!inv && !net && !status) continue

      invoiced += inv
      credits += cr
      netInvoice += net

      if (status === "paid") { paid++; paidValue += net }
      else if (status === "pending") { pending++; pendingValue += net }
      else if (status === "voided") voided++

      if (iso) {
        const mk = iso.slice(0, 7)
        if (!byMonth[mk]) byMonth[mk] = { invoiced: 0, net: 0, orders: 0 }
        byMonth[mk].invoiced += inv
        byMonth[mk].net += net
        byMonth[mk].orders += 1
      }

      for (const { col, gw, field } of gwCols) gateways[gw][field] += num(r[col])

      orders.push({
        date: iso ?? (r[colDate] ?? ""),
        doc,
        customer: (r[colCustomer] ?? "").trim(),
        status: status || "—",
        invoice: inv,
        net,
      })
    }

    orders.sort((a, b) => b.date.localeCompare(a.date))

    const gatewayList = Object.values(gateways)
      .map(g => ({ ...g, netCredit: g.credit || g.amount - g.fee - g.tax }))
      .filter(g => g.amount || g.credit)
      .sort((a, b) => b.amount - a.amount)

    const trend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v }))

    return NextResponse.json({
      totals: {
        orders: orders.length,
        invoiced, credits, netInvoice,
        paid, pending, voided,
        paidValue, pendingValue,
        totalFees: gatewayList.reduce((s, g) => s + g.fee + g.tax, 0),
        totalSettled: gatewayList.reduce((s, g) => s + g.netCredit, 0),
      },
      gateways: gatewayList,
      trend,
      recentOrders: orders.slice(0, 50),
      asOf: new Date().toISOString(),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
