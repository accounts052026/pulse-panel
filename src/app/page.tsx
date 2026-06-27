"use client"
import { useState, useEffect, useCallback } from "react"

// ─── SHEET CONFIG ─────────────────────────────────────────────────────────────
const SHEET_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQic7FAazD2oLAIGRxBT8QGyAbM9pChIruIhS8PtdtcBhuD8c9B0k0EbFG5_duCdkNksq_dxyRF8sM3/pub"
const CF_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2B28C8WnJefHbWfpn3B2lLG6fDn14sjeFOGRZqQ83Be0F5WUwU5LPm1Z1S0OLpNns6P_NgaSWIRsr/pub?output=csv"

const PLATFORMS = [
  { name: "Blinkit",   gid: "34243415",   color: "#F5A623" },
  { name: "Swiggy",    gid: "1352565251",  color: "#FF6B35" },
  { name: "Zepto",     gid: "102885037",   color: "#8B5CF6" },
  { name: "Amazon",    gid: "186113885",   color: "#60A5FA" },
  { name: "BigBasket", gid: "673759145",   color: "#22C55E" },
  { name: "FirstClub", gid: "1936942520",  color: "#EC4899" },
  { name: "LeMarche",  gid: "1044246852",  color: "#F472B6" },
  { name: "GoGlocal",  gid: "664585132",   color: "#A78BFA" },
]

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:          "#0B0F1A",
  surface:     "#131929",
  surfaceAlt:  "#1A2236",
  border:      "#222E45",
  accent:      "#F5A623",
  accentDim:   "#F5A62322",
  positive:    "#22C55E",
  positiveDim: "#22C55E18",
  negative:    "#EF4444",
  negativeDim: "#EF444418",
  neutral:     "#94A3B8",
  white:       "#F1F5F9",
  dimText:     "#64748B",
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.trim().split("\n")) {
    const cols: string[] = []
    let cur = "", inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = "" }
      else { cur += ch }
    }
    cols.push(cur.trim())
    rows.push(cols)
  }
  return rows
}

function n(s: string): number {
  if (!s) return 0
  const clean = s.replace(/[₹,\s"]/g, "").replace(/\(([^)]+)\)/, "-$1")
  return parseFloat(clean) || 0
}


// ─── DATE UTILS ───────────────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null
  // Handles: "23-Mar-2024", "29-Oct-2025", "2024-03-23", "23/03/2024"
  const months: Record<string,number> = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}
  const dmy = s.match(/^(\d{1,2})[\-\/](\w{3})[\-\/](\d{4})$/)
  if (dmy) { const m = months[dmy[2].toLowerCase()]; return isNaN(m) ? null : new Date(+dmy[3], m, +dmy[1]) }
  const ymd = s.match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})$/)
  if (ymd) return new Date(+ymd[1], +ymd[2]-1, +ymd[3])
  const dmy2 = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/)
  if (dmy2) return new Date(+dmy2[3], +dmy2[2]-1, +dmy2[1])
  return null
}

// ─── PLATFORM DATA EXTRACTOR ──────────────────────────────────────────────────
// Tab structure (0-indexed rows):
// Row 0: empty
// Row 1: headers like "Accrual", "Accrual (Event)"
// Row 2: Entity name in D, Accrual in F, Accrual(Event) in G
// Row 3: more entity rows
// Row 4: totals
// Row 5: header row: Date | Transactions | Document No. | Dr. | Cr. | Amount | Amount | Status | Entity | (gap) | Date | Transactions | Doc | Dr. | Cr. | Amount | ...
// Row 6+: AR transaction data (left) | AP transaction data (right, col K+)

interface PlatformCalc {
  name: string
  color: string
  // AR side
  invoice: number
  returns: number
  netSales: number
  payment: number
  ar1: number
  tds: number
  ar2: number
  bfd: number
  ar3: number
  adjustments: number
  ar4: number
  // AP side
  apInvoice: number
  apPayment: number
  ap1: number
  debitNote: number
  ap2: number
  tdsDed: number
  ap3: number
  apAdj: number
  ap4: number
  // net
  net: number
  // raw accrual from summary row
  accrualAR: number
  accrualAP: number
}

function extractPlatformData(rows: string[][], name: string, color: string, dateFrom?: Date, dateTo?: Date): PlatformCalc {
  // Summary rows (rows 2-4): col E=entity, col F=Accrual, col G=Accrual(Event)
  // Find accrual totals from top summary
  let accrualAR = 0, accrualAP = 0
  for (let i = 1; i <= 5; i++) {
    const r = rows[i] || []
    // Col F (idx 5) has AR accrual total, col P (idx 15) has AP accrual total
    if (r[5] && n(r[5]) !== 0 && accrualAR === 0) accrualAR = n(r[5])
    if (r[15] && n(r[15]) !== 0 && accrualAP === 0) accrualAP = n(r[15])
  }

  // Find data start row (row with "Date" in col A)
  let dataStart = 6
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.trim().toLowerCase() === "date" && rows[i][1]?.trim().toLowerCase() === "transactions") {
      dataStart = i + 1
      break
    }
  }

  // AR columns: A=Date(0), B=Transactions(1), C=DocNo(2), D=Dr(3), E=Cr(4), F=Amount(5), G=Amount(6), H=Status(7), I=Entity(8)
  // AP columns: K=Date(10), L=Transactions(11), M=DocNo(12), N=Dr(13), O=Cr(14), P=Amount(15), Q=Amount(16), R=?(17), S=Entity(18)

  let invoice=0, returns=0, payment=0, bfd=0, arAdj=0, tds=0
  let apInvoice=0, apPayment=0, debitNote=0, tdsDed=0, apAdj=0

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length < 6) continue

    // Date filter
    const txDate = parseDate(r[0]?.trim() || "")
    if (txDate) {
      if (dateFrom && txDate < dateFrom) continue
      if (dateTo && txDate > dateTo) continue
    }

    // AR side
    const arType = r[1]?.trim().toLowerCase() || ""
    const arAmt  = n(r[5]) // Amount col F

    if (arAmt !== 0) {
      if (arType === "invoice") invoice += arAmt
      else if (arType === "returns" || arType === "return") returns += arAmt
      else if (arType === "payment") payment += arAmt
      else if (arType === "brand funded discount") bfd += arAmt
      else if (arType === "ar/ap adjustments" || arType === "ar/ap adjustment") arAdj += arAmt
      else if (arType === "tds deducted" || arType === "tds receivable") tds += arAmt
    }

    // AP side (col 11 = transactions, col 15 = amount)
    if (r.length > 11) {
      const apType = r[11]?.trim().toLowerCase() || ""
      const apAmt  = n(r[15]) // Amount col P

      if (apAmt !== 0) {
        if (apType === "invoice") apInvoice += apAmt
        else if (apType === "payment") apPayment += apAmt
        else if (apType === "debit note") debitNote += apAmt
        else if (apType === "tds deducted") tdsDed += apAmt
        else if (apType === "ar/ap adjustments" || apType === "ar/ap adjustment") apAdj += apAmt
      }
    }
  }

  // AR Waterfall
  const netSales = invoice + returns
  const ar1      = netSales - Math.abs(payment)
  const ar2      = ar1 - Math.abs(tds)
  const ar3      = ar2 + bfd  // bfd is negative
  const ar4      = ar3 + arAdj

  // AP Waterfall
  const ap1 = apInvoice + apPayment
  const ap2 = ap1 + debitNote
  const ap3 = ap2 - Math.abs(tdsDed)
  const ap4 = ap3 + apAdj

  const net = ar4 + ap4

  return {
    name, color,
    invoice, returns, netSales, payment, ar1, tds, ar2, bfd, ar3,
    adjustments: arAdj, ar4,
    apInvoice, apPayment, ap1, debitNote, ap2, tdsDed, ap3, apAdj, ap4,
    net, accrualAR, accrualAP,
  }
}

// ─── CF EXTRACTOR ─────────────────────────────────────────────────────────────
function extractCF(rows: string[][]) {
  const months = ["Jun 25","Jul 25","Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Jan 26","Feb 26","Mar 26","Apr 26","May 26"]
  const cashIn: Record<string,number[]> = {}
  const cashOut: Record<string,number[]> = {}
  let netFlow: number[] = []

  const platforms = ["BLINKIT","SWIGGY","ZEPTO","BIGBASKET","D2C","FIRSTCLUB"]
  platforms.forEach(p => {
    const row = rows.find(r => r[0]?.toUpperCase().trim() === p)
    if (row) cashIn[p] = row.slice(2,14).map(n)
  })

  const expLabels: Record<string,string> = {
    "Salary Payable": "Salaries",
    "AMIT VEGETABLES": "Amit Vegetables",
    "NAVEEN GENERAL STORE": "Naveen Gen Store",
    "FOODPRO PACKAGING PRIVATE LIMITED": "Foodpro Packaging",
    "MOVIN EXPRESS PRIVATE LIMITED": "Movin Express",
    "TURTLE MEDIA PRIVATE LIMITED": "Turtle Media",
    "Ads Nischal Naidu Kandula Reimbursement": "Ads Reimbursement",
  }
  Object.keys(expLabels).forEach(label => {
    const row = rows.find(r => r[0]?.trim() === label)
    if (row) cashOut[expLabels[label]] = row.slice(2,14).map(v => Math.abs(n(v)) * -1)
  })

  const netRow = rows.find(r => r[0]?.toLowerCase().includes("monthly net cash"))
  if (netRow) netFlow = netRow.slice(3,15).map(n)

  return { months, cashIn, cashOut, netFlow }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmt(v: number, compact=false): string {
  if (isNaN(v) || !isFinite(v)) return "—"
  const abs = Math.abs(v)
  if (compact) {
    if (abs >= 10000000) return `₹${(v/10000000).toFixed(1)}Cr`
    if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`
    if (abs >= 1000)     return `₹${(abs/1000).toFixed(0)}K`
    return `₹${abs.toFixed(0)}`
  }
  return `₹${abs.toLocaleString("en-IN",{maximumFractionDigits:0})}`
}
function pct(a:number,b:number) { return b ? `${((a/b)*100).toFixed(1)}%` : "—" }


// ─── PLATFORM LOGOS ───────────────────────────────────────────────────────────
const LOGOS: Record<string, string> = {
  Blinkit:   "https://www.blinkit.com/favicon.ico",
  Swiggy:    "https://www.swiggy.com/favicon.ico",
  Zepto:     "https://cdn.zeptonow.com/production/tr:w-300,ar-1-1,pr-true,f-auto,q-80/inventory/brand/b9b45693-2a3e-49aa-86df-4a7e3a8e5d16.png",
  Amazon:    "https://www.amazon.in/favicon.ico",
  BigBasket: "https://www.bigbasket.com/favicon.ico",
  FirstClub: "https://www.firstclub.io/favicon.ico",
  LeMarche:  "https://www.lemarcheretail.in/favicon.ico",
  GoGlocal:  "https://goglocal.live/favicon.ico",
}

// Fallback emoji if favicon fails
const EMOJI: Record<string, string> = {
  Blinkit: "⚡", Swiggy: "🛵", Zepto: "🟣", Amazon: "📦",
  BigBasket: "🧺", FirstClub: "🏪", LeMarche: "🛒", GoGlocal: "🌐",
}

function PlatformLogo({ name, size = 20 }: { name: string; size?: number }) {
  const src = LOGOS[name]
  const bg = PLATFORMS.find(p => p.name === name)?.color || "#94A3B8"
  const emoji = EMOJI[name] || name[0]
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: size * 0.25, background: bg + "33", border: `1px solid ${bg}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55, flexShrink: 0 }}>
        {emoji}
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      <img src={src} alt={name} style={{ width: "85%", height: "85%", objectFit: "contain" }}
        onError={() => setFailed(true)} />
    </div>
  )
}

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
function Badge({children,color}:{children:React.ReactNode;color:string}) {
  return <span style={{background:color+"22",color,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,letterSpacing:1,textTransform:"uppercase" as const,whiteSpace:"nowrap" as const}}>{children}</span>
}
function KpiCard({label,value,sub,color}:{label:string;value:string;sub?:string;color?:string}) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px",flex:1,minWidth:150}}>
      <div style={{color:C.dimText,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase" as const,marginBottom:8}}>{label}</div>
      <div style={{color:color||C.white,fontSize:22,fontWeight:800,letterSpacing:-0.5}}>{value}</div>
      {sub && <div style={{color:C.dimText,fontSize:11,marginTop:4}}>{sub}</div>}
      <div style={{height:2,background:C.accent,borderRadius:2,marginTop:12,width:32}}/>
    </div>
  )
}
function NavTab({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}) {
  return <button onClick={onClick} style={{background:active?C.accent:"transparent",color:active?"#0B0F1A":C.neutral,border:"none",cursor:"pointer",padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:active?700:500,transition:"all 0.15s"}}>{label}</button>
}
function Th({children}:{children:React.ReactNode}) {
  return <th style={{color:C.dimText,fontWeight:700,fontSize:9,letterSpacing:1,padding:"10px 12px",textAlign:"left" as const,textTransform:"uppercase" as const,whiteSpace:"nowrap" as const,background:C.surfaceAlt}}>{children}</th>
}
function BarChart({data,height=100}:{data:{label:string;value:number}[];height?:number}) {
  const max = Math.max(...data.map(d=>Math.abs(d.value)),1)
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height,marginTop:8}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",maxWidth:32,height:`${(Math.abs(d.value)/max)*height*0.85}px`,background:d.value>=0?C.positive:C.negative,borderRadius:"3px 3px 0 0",opacity:0.85,minHeight:2}}/>
          <div style={{color:C.dimText,fontSize:8,textAlign:"center" as const}}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── AR/AP TAB ────────────────────────────────────────────────────────────────
function ARAPTab({platforms}:{platforms:PlatformCalc[]}) {
  const [view,setView] = useState<"summary"|"waterfall"|"platform_detail">("summary")
  const [selP,setSelP] = useState<string|null>(null)

  const totAR4 = platforms.reduce((s,p)=>s+p.ar4,0)
  const totAP4 = platforms.reduce((s,p)=>s+p.ap4,0)
  const totNet = totAR4+totAP4
  const totInv = platforms.reduce((s,p)=>s+p.invoice,0)
  const totBFD = platforms.reduce((s,p)=>s+p.bfd,0)
  const totPlatCost = platforms.reduce((s,p)=>s+p.apInvoice,0)

  const wf = [
    {label:"INVOICE",           ar:platforms.reduce((s,p)=>s+p.invoice,0),    ap:platforms.reduce((s,p)=>s+p.apInvoice,0)},
    {label:"RETURNS",           ar:platforms.reduce((s,p)=>s+p.returns,0),    ap:null},
    {label:"NET SALES",         ar:platforms.reduce((s,p)=>s+p.netSales,0),   ap:null, divider:true},
    {label:"PAYMENT RECEIVED",  ar:platforms.reduce((s,p)=>s+p.payment,0),    ap:platforms.reduce((s,p)=>s+p.apPayment,0)},
    {label:"AR1 / AP1",         ar:platforms.reduce((s,p)=>s+p.ar1,0),        ap:platforms.reduce((s,p)=>s+p.ap1,0), highlight:true},
    {label:"TDS",               ar:platforms.reduce((s,p)=>s+p.tds,0),        ap:platforms.reduce((s,p)=>s+p.tdsDed,0)},
    {label:"AR2 / AP2",         ar:platforms.reduce((s,p)=>s+p.ar2,0),        ap:platforms.reduce((s,p)=>s+p.ap2,0), highlight:true},
    {label:"BRAND FUNDED DISC", ar:platforms.reduce((s,p)=>s+p.bfd,0),        ap:platforms.reduce((s,p)=>s+p.debitNote,0)},
    {label:"AR3 / AP3",         ar:platforms.reduce((s,p)=>s+p.ar3,0),        ap:platforms.reduce((s,p)=>s+p.ap3,0), highlight:true},
    {label:"AR/AP ADJUSTMENTS", ar:platforms.reduce((s,p)=>s+p.adjustments,0),ap:platforms.reduce((s,p)=>s+p.apAdj,0)},
    {label:"AR4 / AP4 (FINAL)", ar:totAR4, ap:totAP4, highlight:true, final:true},
  ]

  return (
    <div>
      {/* KPI Strip */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <KpiCard label="AR4 — Net Receivable" value={fmt(totAR4,true)} sub="After BFD & adjustments" color={C.positive}/>
        <KpiCard label="Platform Costs (AP)" value={fmt(Math.abs(totPlatCost),true)} sub="Invoiced by platforms" color={C.negative}/>
        <KpiCard label="Net Position" value={fmt(totNet,true)} sub="AR4 − AP4" color={totNet>=0?C.positive:C.negative}/>
        <KpiCard label="Gross Invoice" value={fmt(totInv,true)} sub="Total invoiced to platforms" color={C.accent}/>
        <KpiCard label="BFD Setoff" value={fmt(Math.abs(totBFD),true)} sub="Brand funded discounts" color={C.neutral}/>
      </div>

      {/* Platform logo strip — quick glance */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {platforms.map((p,i)=>(
          <div key={i} onClick={()=>{setSelP(p.name);setView("platform_detail")}}
            title={`${p.name} — Net: ${fmt(p.net,true)}`}
            style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${p.net>=0?p.color+"55":C.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
            onMouseLeave={e=>e.currentTarget.style.background=C.surface}>
            <PlatformLogo name={p.name} size={18}/>
            <span style={{color:p.color,fontSize:11,fontWeight:700}}>{p.name}</span>
            <span style={{color:p.net>=0?C.positive:C.negative,fontSize:11,fontWeight:800}}>{p.net>=0?"+":""}{(p.net/100000).toFixed(1)}L</span>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        <NavTab label="Platform Summary" active={view==="summary"} onClick={()=>{setView("summary");setSelP(null)}}/>
        <NavTab label="Waterfall" active={view==="waterfall"} onClick={()=>setView("waterfall")}/>
        {selP && <NavTab label={`${selP} Detail`} active={view==="platform_detail"} onClick={()=>setView("platform_detail")}/>}
      </div>

      {/* ── SUMMARY VIEW — platforms as columns ── */}
      {view==="summary" && (()=>{
        const arRows = [
          {key:"invoice",    label:"Gross Sales",       sub:"Invoiced to platform",         bold:false, divider:false},
          {key:"returns",    label:"(-) Returns & CNs", sub:"Credit notes raised",           bold:false, divider:false},
          {key:"netSales",   label:"Net Sales",         sub:"After returns",                 bold:true,  divider:true},
          {key:"payment",    label:"(-) Payment Recd",  sub:"Cash received from platform",   bold:false, divider:false},
          {key:"ar1",        label:"AR — 1",            sub:"Net Sales minus Payment",        bold:true,  divider:false, highlight:true},
          {key:"tds",        label:"(-) TDS",           sub:"Tax deducted at source",         bold:false, divider:false},
          {key:"ar2",        label:"AR — 2",            sub:"After TDS",                     bold:true,  divider:false, highlight:true},
          {key:"bfd",        label:"(-) BFD",           sub:"Brand funded discounts",         bold:false, divider:false},
          {key:"ar3",        label:"AR — 3",            sub:"After BFD setoff",              bold:true,  divider:false, highlight:true},
          {key:"adjustments",label:"(±) Adjustments",  sub:"AR/AP netting adjustments",     bold:false, divider:false},
          {key:"ar4",        label:"AR — 4  ✦ FINAL",  sub:"Net receivable from platform",  bold:true,  divider:true,  highlight:true, final:true},
        ]
        const apRows = [
          {key:"apInvoice",  label:"Platform Cost",     sub:"Invoiced by platform (ads/fees)",bold:false, divider:false},
          {key:"apPayment",  label:"(-) Paid",          sub:"Amount paid to platform",        bold:false, divider:false},
          {key:"ap1",        label:"AP — 1",            sub:"Outstanding platform cost",      bold:true,  divider:false, highlight:true},
          {key:"debitNote",  label:"(+) Debit Note",   sub:"Debit notes raised",             bold:false, divider:false},
          {key:"ap2",        label:"AP — 2",            sub:"After debit notes",              bold:true,  divider:false, highlight:true},
          {key:"tdsDed",     label:"(-) TDS Deducted", sub:"TDS on platform payments",       bold:false, divider:false},
          {key:"ap3",        label:"AP — 3",            sub:"After TDS",                     bold:true,  divider:false, highlight:true},
          {key:"apAdj",      label:"(±) Adjustments",  sub:"Netting adjustments",            bold:false, divider:false},
          {key:"ap4",        label:"AP — 4  ✦ FINAL",  sub:"Net payable to platform",        bold:true,  divider:true,  highlight:true, final:true},
        ]

        const colStyle = (p: PlatformCalc) => ({padding:"10px 14px", textAlign:"right" as const, borderLeft:`1px solid ${C.border}`})
        const valColor = (v:number, isAP=false) => {
          if(v===0) return C.dimText
          if(isAP) return v<0 ? C.negative : C.positive
          return v<0 ? C.negative : C.positive
        }

        return (
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>

            {/* ── AR TABLE ── */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              {/* Section header */}
              <div style={{padding:"8px 14px",background:"#22C55E0F",borderBottom:`1px solid ${C.positive}33`,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:3,height:28,background:C.positive,borderRadius:2}}/>
                <div>
                  <div style={{color:C.positive,fontWeight:800,fontSize:12,letterSpacing:0.5}}>ACCOUNTS RECEIVABLE</div>
                  <div style={{color:C.dimText,fontSize:10}}>What platforms owe CURRYiT</div>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
                  <thead>
                    <tr style={{background:C.surfaceAlt}}>
                      <th style={{padding:"8px 14px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,letterSpacing:1,minWidth:160,position:"sticky" as const,left:0,top:0,zIndex:3,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`}}>LINE ITEM</th>
                      {platforms.map(p=>(
                        <th key={p.name} style={{padding:"6px 10px",textAlign:"center" as const,borderLeft:`1px solid ${C.border}`,minWidth:90,position:"sticky" as const,top:0,zIndex:2,background:C.surfaceAlt}}>
                          <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3}}>
                            <PlatformLogo name={p.name} size={18}/>
                            <span style={{color:p.color,fontWeight:700,fontSize:9}}>{p.name}</span>
                          </div>
                        </th>
                      ))}
                      <th style={{padding:"6px 10px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,minWidth:90,color:C.accent,fontWeight:700,fontSize:9,letterSpacing:1,position:"sticky" as const,top:0,right:0,zIndex:3,background:C.surfaceAlt}}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arRows.map((row,i)=>{
                      const vals = platforms.map(p=>(p as any)[row.key] as number)
                      const total = vals.reduce((a,b)=>a+b,0)
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${row.divider?C.accent+"33":C.border+"88"}`,background:row.final?"#22C55E08":row.highlight?C.surfaceAlt:"transparent",borderTop:row.divider?`1px solid ${C.border}`:"none"}}>
                          <td style={{padding:"6px 14px",position:"sticky" as const,left:0,zIndex:1,background:row.final?"#22C55E08":row.highlight?C.surfaceAlt:C.bg,borderRight:`1px solid ${C.border}`}}>
                            <div style={{color:row.final?C.positive:row.bold?C.white:C.neutral,fontWeight:row.bold?700:400,fontSize:row.final?11:10,whiteSpace:"nowrap" as const}}>{row.label}</div>
                            {!row.highlight && <div style={{color:C.dimText,fontSize:8,marginTop:1}}>{row.sub}</div>}
                          </td>
                          {vals.map((v,j)=>(
                            <td key={j} style={{...colStyle(platforms[j]),color:v===0?C.dimText+"33":valColor(v),fontWeight:row.bold?700:400,fontSize:row.final?11:10,padding:"6px 10px"}}>
                              {v===0?"—":fmt(v,true)}
                            </td>
                          ))}
                          <td style={{padding:"6px 12px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,color:total===0?C.dimText:valColor(total),fontWeight:800,fontSize:row.final?12:10,position:"sticky" as const,right:0,background:row.final?"#22C55E08":row.highlight?C.surfaceAlt:C.bg}}>
                            {total===0?"—":fmt(total,true)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── AP TABLE ── */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"8px 14px",background:"#EF44440F",borderBottom:`1px solid ${C.negative}33`,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:3,height:28,background:C.negative,borderRadius:2}}/>
                <div>
                  <div style={{color:C.negative,fontWeight:800,fontSize:12,letterSpacing:0.5}}>PLATFORM COSTS (AP)</div>
                  <div style={{color:C.dimText,fontSize:10}}>Marketing, fulfilment & ad spend — what CURRYiT owes platforms</div>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
                  <thead>
                    <tr style={{background:C.surfaceAlt}}>
                      <th style={{padding:"8px 14px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,letterSpacing:1,minWidth:160,position:"sticky" as const,left:0,top:0,zIndex:3,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`}}>LINE ITEM</th>
                      {platforms.map(p=>(
                        <th key={p.name} style={{padding:"6px 10px",textAlign:"center" as const,borderLeft:`1px solid ${C.border}`,minWidth:90,position:"sticky" as const,top:0,zIndex:2,background:C.surfaceAlt}}>
                          <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3}}>
                            <PlatformLogo name={p.name} size={18}/>
                            <span style={{color:p.color,fontWeight:700,fontSize:9}}>{p.name}</span>
                          </div>
                        </th>
                      ))}
                      <th style={{padding:"6px 10px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,minWidth:90,color:C.accent,fontWeight:700,fontSize:9,letterSpacing:1,position:"sticky" as const,top:0,right:0,zIndex:3,background:C.surfaceAlt}}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apRows.map((row,i)=>{
                      const vals = platforms.map(p=>(p as any)[row.key] as number)
                      const total = vals.reduce((a,b)=>a+b,0)
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${row.divider?C.accent+"33":C.border+"88"}`,background:row.final?"#EF44440A":row.highlight?C.surfaceAlt:"transparent",borderTop:row.divider?`1px solid ${C.border}`:"none"}}>
                          <td style={{padding:"6px 14px",position:"sticky" as const,left:0,zIndex:1,background:row.final?"#EF44440A":row.highlight?C.surfaceAlt:C.bg,borderRight:`1px solid ${C.border}`}}>
                            <div style={{color:row.final?C.negative:row.bold?C.white:C.neutral,fontWeight:row.bold?700:400,fontSize:row.final?11:10,whiteSpace:"nowrap" as const}}>{row.label}</div>
                            {!row.highlight && <div style={{color:C.dimText,fontSize:8,marginTop:1}}>{row.sub}</div>}
                          </td>
                          {vals.map((v,j)=>(
                            <td key={j} style={{...colStyle(platforms[j]),color:v===0?C.dimText+"33":valColor(v,true),fontWeight:row.bold?700:400,fontSize:row.final?11:10,padding:"6px 10px"}}>
                              {v===0?"—":fmt(v,true)}
                            </td>
                          ))}
                          <td style={{padding:"6px 12px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,color:total===0?C.dimText:valColor(total,true),fontWeight:800,fontSize:row.final?12:10,position:"sticky" as const,right:0,background:row.final?"#EF44440A":row.highlight?C.surfaceAlt:C.bg}}>
                            {total===0?"—":fmt(total,true)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── NET POSITION ROW — sticky at bottom ── */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
                  <tbody>
                    <tr style={{background:C.accentDim}}>
                      <td style={{padding:"8px 14px",minWidth:160,position:"sticky" as const,left:0,background:C.accentDim,zIndex:2,borderRight:`1px solid ${C.border}`}}>
                        <div style={{color:C.accent,fontWeight:800,fontSize:11,whiteSpace:"nowrap" as const}}>NET POSITION  ✦</div>
                        <div style={{color:C.dimText,fontSize:8,marginTop:1}}>AR4 + AP4 per platform</div>
                      </td>
                      {platforms.map((p,i)=>(
                        <td key={i} style={{padding:"8px 10px",textAlign:"right" as const,borderLeft:`1px solid ${C.border}`}}>
                          <div style={{color:p.net>=0?C.positive:C.negative,fontWeight:800,fontSize:11}}>{fmt(p.net,true)}</div>
                          <Badge color={p.net>=0?C.positive:C.negative}>{p.net>=0?"+ve":"−ve"}</Badge>
                        </td>
                      ))}
                      <td style={{padding:"8px 10px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,position:"sticky" as const,right:0,background:C.accentDim}}>
                        <div style={{color:totNet>=0?C.positive:C.negative,fontWeight:800,fontSize:13}}>{fmt(totNet,true)}</div>
                        <Badge color={totNet>=0?C.positive:C.negative}>{totNet>=0?"+ve":"−ve"}</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )
      })()}

      {/* ── WATERFALL VIEW ── */}
      {view==="waterfall" && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",borderBottom:`1px solid ${C.border}`,padding:"10px 16px",background:C.surfaceAlt}}>
            {["LINE ITEM","ACCOUNTS RECEIVABLE","PLATFORM COSTS (AP)"].map(h=>(
              <div key={h} style={{color:C.dimText,fontSize:10,fontWeight:700,letterSpacing:1}}>{h}</div>
            ))}
          </div>
          {wf.map((row,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"10px 16px",background:row.final?C.accentDim:row.highlight?C.surfaceAlt:"transparent",borderBottom:`1px solid ${C.border}`,borderTop:row.divider?`1px solid ${C.accent}44`:"none"}}>
              <div style={{color:row.final?C.accent:row.highlight?C.white:C.neutral,fontSize:12,fontWeight:row.final||row.highlight?700:400}}>{row.label}</div>
              <div style={{color:(row.ar??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>{row.ar===null?"—":fmt(row.ar??0)}</div>
              <div style={{color:row.ap===null?C.dimText:(row.ap??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>{row.ap===null?"—":fmt(row.ap??0)}</div>
            </div>
          ))}
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"12px 16px",background:C.accentDim}}>
            <div style={{color:C.accent,fontSize:12,fontWeight:800}}>NET POSITION</div>
            <div style={{color:totNet>=0?C.positive:C.negative,fontSize:12,fontWeight:800}}>{fmt(totNet)}</div>
            <div style={{color:C.dimText,fontSize:11}}>AR4 − |AP4|</div>
          </div>
        </div>
      )}

      {/* ── PLATFORM DETAIL VIEW ── */}
      {view==="platform_detail" && selP && (()=>{
        const p = platforms.find(x=>x.name===selP)!
        if(!p) return null
        return (
          <div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              {platforms.map(pl=>(
                <button key={pl.name} onClick={()=>setSelP(pl.name)}
                  style={{background:selP===pl.name?pl.color+"33":"transparent",color:selP===pl.name?pl.color:C.neutral,border:`1px solid ${selP===pl.name?pl.color:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  <PlatformLogo name={pl.name} size={14}/>{pl.name}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {/* AR Card */}
              <div style={{background:C.surface,border:`1px solid ${C.positive}44`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:C.positiveDim,display:"flex",alignItems:"center",gap:8}}>
                  <PlatformLogo name={p.name} size={22}/>
                  <span style={{color:C.white,fontWeight:700}}>{p.name} — Receivable</span>
                </div>
                {[
                  {label:"Gross Invoice",val:p.invoice,color:C.white,bold:true},
                  {label:"Returns",val:p.returns,color:C.negative},
                  {label:"Net Sales",val:p.netSales,color:C.white,bold:true,div:true},
                  {label:"Payment Received",val:p.payment,color:C.negative},
                  {label:"AR1",val:p.ar1,color:C.positive,bold:true},
                  {label:"TDS Receivable",val:p.tds,color:C.neutral},
                  {label:"AR2",val:p.ar2,color:C.positive,bold:true},
                  {label:"Brand Funded Disc",val:p.bfd,color:C.accent},
                  {label:"AR3",val:p.ar3,color:C.positive,bold:true},
                  {label:"Adjustments",val:p.adjustments,color:C.neutral},
                  {label:"AR4 — FINAL",val:p.ar4,color:C.positive,bold:true,final:true},
                ].map((r,j)=>(
                  <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",background:r.final?C.positiveDim:r.div?C.surfaceAlt:"transparent",borderBottom:`1px solid ${C.border}22`}}>
                    <span style={{color:r.bold?C.white:C.dimText,fontSize:12,fontWeight:r.bold?600:400}}>{r.label}</span>
                    <span style={{color:r.color,fontSize:12,fontWeight:r.bold?700:500}}>{r.val!==0?fmt(r.val):"—"}</span>
                  </div>
                ))}
              </div>
              {/* AP Card */}
              <div style={{background:C.surface,border:`1px solid ${C.negative}44`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:C.negativeDim,display:"flex",alignItems:"center",gap:8}}>
                  <PlatformLogo name={p.name} size={22}/>
                  <span style={{color:C.white,fontWeight:700}}>{p.name} — Platform Costs</span>
                </div>
                {[
                  {label:"Cost Invoiced (by platform)",val:p.apInvoice,color:C.negative,bold:true},
                  {label:"Amount Paid",val:p.apPayment,color:C.positive},
                  {label:"AP1 (Outstanding Cost)",val:p.ap1,color:C.negative,bold:true,div:true},
                  {label:"Debit Note",val:p.debitNote,color:C.neutral},
                  {label:"AP2",val:p.ap2,color:C.negative,bold:true},
                  {label:"TDS Deducted",val:p.tdsDed,color:C.positive},
                  {label:"AP3",val:p.ap3,color:C.negative,bold:true},
                  {label:"Adjustments",val:p.apAdj,color:C.neutral},
                  {label:"AP4 — NET PAYABLE",val:p.ap4,color:p.ap4<=0?C.negative:C.positive,bold:true,final:true},
                ].map((r,j)=>(
                  <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",background:r.final?C.negativeDim:r.div?C.surfaceAlt:"transparent",borderBottom:`1px solid ${C.border}22`}}>
                    <span style={{color:r.bold?C.white:C.dimText,fontSize:12,fontWeight:r.bold?600:400}}>{r.label}</span>
                    <span style={{color:r.color,fontSize:12,fontWeight:r.bold?700:500}}>{r.val!==0?fmt(r.val):"—"}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Net for this platform */}
            <div style={{marginTop:12,background:C.surface,border:`1px solid ${p.net>=0?C.positive:C.negative}44`,borderRadius:12,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.dimText,fontSize:12}}>Net Position for {p.name}</span>
              <span style={{color:p.net>=0?C.positive:C.negative,fontSize:22,fontWeight:800}}>{fmt(p.net,true)}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}


// ─── P&L TAB ──────────────────────────────────────────────────────────────────
function PLTab() {
  const fy25={sales:61491809,discounts:-22489807,netSales:39340481,cogs:23244740,grossProfit:16095741,opex:43117089,ebitda:-27021347}
  const fy26={sales:100708456,discounts:-36667471,netSales:64297013,cogs:31743426,grossProfit:32553587,opex:73911815,ebitda:-41358228}
  const opex=[
    {label:"Salaries",fy25:8186785,fy26:14683082},
    {label:"Advertising & Mktg",fy25:21134694,fy26:32986533},
    {label:"Outbound Logistics",fy25:3178502,fy26:5396965},
    {label:"Rent",fy25:1316500,fy26:1899500},
    {label:"Civil & Maintenance",fy25:0,fy26:3702623},
    {label:"Legal & Professional",fy25:3360527,fy26:154970},
    {label:"Staff Welfare",fy25:204359,fy26:1194407},
    {label:"Technology",fy25:120472,fy26:324514},
  ]
  // Historical P&L FY21-FY26 (₹ Lakhs)
  const hist = [
    {fy:"FY21",income:2.35,  revOps:2.36,  expenses:10.24,empBen:3.60,otherExp:6.64, ebitda:-7.89},
    {fy:"FY22",income:14.62, revOps:14.61, expenses:33.83,empBen:8.38,otherExp:29.05,ebitda:-32.53},
    {fy:"FY23",income:40.67, revOps:40.67, expenses:141.64,empBen:26.81,otherExp:75.02,ebitda:-100.97},
    {fy:"FY24",income:89.08, revOps:88.58, expenses:227.11,empBen:38.00,otherExp:144.70,ebitda:-138.03},
    {fy:"FY25",income:394.86,revOps:390.02,expenses:744.81,empBen:82.82,otherExp:402.89,ebitda:-350.05},
    {fy:"FY26",income:642.97,revOps:640.00,expenses:1073.00,empBen:146.83,otherExp:599.52,ebitda:-413.58},
  ]
  const [view,setView]=useState<"trend"|"annual"|"opex">("trend")

  return (
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <KpiCard label="FY26 Gross Sales" value={fmt(fy26.sales,true)} sub={`↑ from ${fmt(fy25.sales,true)} FY25`} color={C.positive}/>
        <KpiCard label="Gross Margin FY26" value={pct(fy26.grossProfit,fy26.netSales)} sub={`${pct(fy25.grossProfit,fy25.netSales)} in FY25`} color={C.accent}/>
        <KpiCard label="EBITDA FY26" value={fmt(fy26.ebitda,true)} sub="Operating loss" color={C.negative}/>
        <KpiCard label="Gross Profit FY26" value={fmt(fy26.grossProfit,true)} sub={`↑ 2x from ${fmt(fy25.grossProfit,true)}`} color={C.positive}/>
      </div>
      <div style={{padding:"8px 12px",background:C.accentDim,borderRadius:8,marginBottom:16}}>
        <span style={{color:C.accent,fontSize:11}}>ℹ P&L from Zoho Books provisional export — update when new monthly data available</span>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        <NavTab label="6-Year Trend" active={view==="trend"} onClick={()=>setView("trend")}/>
        <NavTab label="FY25 vs FY26" active={view==="annual"} onClick={()=>setView("annual")}/>
        <NavTab label="OpEx Breakdown" active={view==="opex"} onClick={()=>setView("opex")}/>
      </div>

      {/* ── 6-YEAR TREND ── */}
      {view==="trend" && (
        <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
          {/* Insight cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {[
              {icon:"📈",title:"Revenue CAGR",val:"178%",sub:"FY21→FY26 (5 years)",color:C.positive},
              {icon:"🚀",title:"Revenue Growth",val:"27x",sub:"₹2.35L → ₹643L in 6 years",color:C.positive},
              {icon:"📉",title:"EBITDA Loss",val:"52x",sub:"₹7.9L → ₹413L widening",color:C.negative},
              {icon:"🎯",title:"Gross Margin FY26",val:"50.6%",sub:"Up from 40.9% in FY25",color:C.accent},
            ].map((card,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${card.color}33`,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{fontSize:18}}>{card.icon}</div>
                <div>
                  <div style={{color:card.color,fontWeight:800,fontSize:18}}>{card.val}</div>
                  <div style={{color:C.white,fontWeight:600,fontSize:11,marginTop:1}}>{card.title}</div>
                  <div style={{color:C.dimText,fontSize:10,marginTop:1}}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{color:C.white,fontWeight:700,fontSize:13}}>Revenue vs EBITDA Loss — FY21 to FY26</div>
                <div style={{color:C.dimText,fontSize:10,marginTop:2}}>All figures in ₹ Lakhs</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:2,background:C.positive}}/><span style={{color:C.dimText,fontSize:9}}>Revenue</span></div>
                <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:2,background:C.negative+"88"}}/><span style={{color:C.dimText,fontSize:9}}>EBITDA Loss</span></div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:180}}>
              {hist.map((d,i)=>{
                const maxR=Math.max(...hist.map(x=>x.income))
                const maxE=Math.max(...hist.map(x=>Math.abs(x.ebitda)))
                const rH=Math.max((d.income/maxR)*140,3)
                const eH=Math.max((Math.abs(d.ebitda)/maxE)*80,3)
                const isCurrent=d.fy==="FY26"
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:0}}>
                    <div style={{color:C.positive,fontSize:isCurrent?10:8,fontWeight:isCurrent?800:500,marginBottom:3}}>{d.income>=100?`₹${(d.income).toFixed(0)}L`:`₹${d.income}L`}</div>
                    <div style={{width:"60%",background:isCurrent?C.positive:`${C.positive}99`,height:`${rH}px`,borderRadius:"4px 4px 0 0"}}/>
                    <div style={{width:"40%",background:isCurrent?C.negative:`${C.negative}66`,height:`${eH}px`,borderRadius:"0 0 3px 3px"}}/>
                    <div style={{color:isCurrent?C.accent:C.neutral,fontSize:10,fontWeight:isCurrent?800:500,marginTop:4}}>{d.fy}</div>
                    <div style={{color:C.negative,fontSize:8,marginTop:1}}>-{Math.abs(d.ebitda).toFixed(0)}L</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Historical table — columns = FY, rows = metrics */}
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,background:C.surfaceAlt}}>
              <span style={{color:C.white,fontWeight:700,fontSize:13}}>P&L Summary FY21–FY26</span>
              <span style={{color:C.dimText,fontSize:10,marginLeft:8}}>(₹ Lakhs)</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
                <thead>
                  <tr style={{background:C.surfaceAlt}}>
                    <th style={{padding:"8px 14px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,letterSpacing:1,position:"sticky" as const,left:0,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`,minWidth:140}}>METRIC</th>
                    {hist.map(d=>(
                      <th key={d.fy} style={{padding:"8px 14px",textAlign:"right" as const,color:d.fy==="FY26"?C.accent:C.dimText,fontWeight:d.fy==="FY26"?800:600,fontSize:d.fy==="FY26"?12:10,minWidth:70,borderLeft:`1px solid ${C.border}`,background:d.fy==="FY26"?C.accentDim:"transparent"}}>
                        {d.fy}{d.fy==="FY26"?" ✦":""}
                      </th>
                    ))}
                    <th style={{padding:"8px 14px",textAlign:"right" as const,color:C.accent,fontWeight:700,fontSize:9,borderLeft:`2px solid ${C.accent}44`,minWidth:60}}>CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {label:"Total Income",   key:"income",   color:C.white,   bold:true,  isPos:true},
                    {label:"Revenue Ops",    key:"revOps",   color:C.neutral, bold:false, isPos:true},
                    {label:"Total Expenses", key:"expenses", color:C.negative,bold:true,  isPos:false},
                    {label:"Employee Cost",  key:"empBen",   color:C.neutral, bold:false, isPos:false},
                    {label:"Other Expenses", key:"otherExp", color:C.neutral, bold:false, isPos:false},
                    {label:"EBITDA",         key:"ebitda",   color:C.negative,bold:true,  isPos:false,final:true},
                  ].map((row:any,i)=>{
                    const vals=hist.map(d=>(d as any)[row.key] as number)
                    const cagr=vals[0]&&Math.abs(vals[0])>0?(((Math.abs(vals[5])/Math.abs(vals[0]))**(1/5))-1)*100:null
                    return (
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:row.final?C.negativeDim:"transparent"}}>
                        <td style={{padding:"7px 14px",color:row.final?C.negative:row.bold?C.white:C.neutral,fontWeight:row.bold?700:400,position:"sticky" as const,left:0,background:row.final?C.negativeDim:C.bg,borderRight:`1px solid ${C.border}`,whiteSpace:"nowrap" as const,fontSize:row.final?12:11}}>{row.label}</td>
                        {vals.map((v,j)=>{
                          const prev=j>0?vals[j-1]:null
                          const grew=prev!==null&&Math.abs(v)>Math.abs(prev)
                          const isCurr=hist[j].fy==="FY26"
                          return (
                            <td key={j} style={{padding:"7px 14px",textAlign:"right" as const,borderLeft:`1px solid ${C.border}`,color:isCurr?(row.isPos?C.positive:C.negative):row.color,fontWeight:isCurr?700:row.bold?600:400,background:isCurr?C.accentDim+"66":"transparent",fontSize:isCurr?12:10}}>
                              {Math.abs(v)<0.01?"—":Math.abs(v).toFixed(1)}
                              {j>0&&v!==0&&<span style={{color:grew?(row.isPos?C.positive+"77":C.negative+"77"):(row.isPos?C.negative+"77":C.positive+"77"),fontSize:8,marginLeft:2}}>{grew?"↑":"↓"}</span>}
                            </td>
                          )
                        })}
                        <td style={{padding:"7px 14px",textAlign:"right" as const,borderLeft:`2px solid ${C.accent}44`,color:C.accent,fontWeight:700,fontSize:11}}>
                          {cagr!==null?`${Math.abs(cagr).toFixed(0)}%`:"—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FY25 vs FY26 ── */}
      {view==="annual" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {([["FY 2024-25",fy25],["FY 2025-26",fy26]] as const).map(([label,d]:any,idx)=>(
            <div key={idx} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:`3px solid ${idx===1?C.accent:C.border}`}}>
              <div style={{color:idx===1?C.accent:C.neutral,fontWeight:800,fontSize:14,marginBottom:16}}>{label}</div>
              {[
                {label:"Gross Sales",val:d.sales,color:C.white,bold:true},
                {label:"(-) Discounts & Trade",val:d.discounts,color:C.negative},
                {label:"Net Revenue",val:d.netSales,color:C.white,bold:true},
                {label:"(-) Cost of Goods Sold",val:-d.cogs,color:C.negative},
                {label:"Gross Profit",val:d.grossProfit,color:C.positive,bold:true},
                {label:"Gross Margin %",val:pct(d.grossProfit,d.netSales),color:C.accent,isStr:true},
                {label:"(-) Operating Expenses",val:-d.opex,color:C.negative},
                {label:"EBITDA",val:d.ebitda,color:d.ebitda>=0?C.positive:C.negative,bold:true},
              ].map((r:any,j)=>(
                <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}22`}}>
                  <span style={{color:r.bold?C.white:C.dimText,fontSize:12,fontWeight:r.bold?600:400}}>{r.label}</span>
                  <span style={{color:r.color,fontSize:12,fontWeight:r.bold?700:500}}>{r.isStr?r.val:r.val<0?`(${fmt(-r.val,true)})`:fmt(r.val,true)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── OPEX ── */}
      {view==="opex" && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{color:C.white,fontWeight:700,marginBottom:16}}>OpEx Breakdown — FY25 vs FY26</div>
          {opex.sort((a,b)=>b.fy26-a.fy26).map((r,i)=>{
            const maxVal=Math.max(...opex.map(x=>x.fy26))
            return (
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.neutral,fontSize:12}}>{r.label}</span>
                  <div style={{display:"flex",gap:16}}>
                    <span style={{color:C.dimText,fontSize:11}}>FY25: {fmt(r.fy25,true)}</span>
                    <span style={{color:C.white,fontSize:12,fontWeight:600,minWidth:60,textAlign:"right" as const}}>FY26: {fmt(r.fy26,true)}</span>
                  </div>
                </div>
                <div style={{background:C.border,borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{display:"flex",height:"100%"}}>
                    <div style={{width:`${(r.fy25/maxVal)*100}%`,background:C.dimText,opacity:0.5}}/>
                    <div style={{width:`${Math.max(0,(r.fy26-r.fy25)/maxVal)*100}%`,background:r.label.includes("Mktg")?C.accent:C.negative}}/>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── CF TAB ───────────────────────────────────────────────────────────────────
function CFTab({cfRows}:{cfRows:string[][]}) {
  const [view,setView]=useState<"monthly"|"vendors">("monthly")
  const {months,cashIn,cashOut,netFlow}=extractCF(cfRows)
  const totalIn =months.map((_,i)=>Object.values(cashIn).reduce((s,a)=>s+(a[i]||0),0))
  const totalOut=months.map((_,i)=>Object.values(cashOut).reduce((s,a)=>s+(a[i]||0),0))

  return (
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <KpiCard label="Avg Monthly Cash In" value={fmt(totalIn.length?totalIn.reduce((a,b)=>a+b,0)/totalIn.length:0,true)} sub="Platform receipts avg" color={C.positive}/>
        <KpiCard label="Avg Monthly Cash Out" value={fmt(totalOut.length?Math.abs(totalOut.reduce((a,b)=>a+b,0)/totalOut.length):0,true)} sub="All expenses avg" color={C.negative}/>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        <NavTab label="Monthly Flow" active={view==="monthly"} onClick={()=>setView("monthly")}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{color:C.white,fontWeight:700,marginBottom:4}}>Monthly Net Cash Flow</div>
          {netFlow.length>0&&<BarChart data={netFlow.map((v,i)=>({label:(months[i]||"").substring(0,3),value:v}))} height={130}/>}
        </div>
        {/* Cash IN table */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.positive}}/>
            <span style={{color:C.white,fontWeight:700,fontSize:13}}>Cash IN — Platform Receipts</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11,minWidth:900}}>
              <thead><tr style={{background:C.surfaceAlt}}>
                <th style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 12px",textAlign:"left" as const,letterSpacing:1,minWidth:110}}>PLATFORM</th>
                {months.map(m=><th key={m} style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 10px",textAlign:"right" as const,whiteSpace:"nowrap" as const}}>{m}</th>)}
                <th style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 10px",textAlign:"right" as const}}>TOTAL</th>
              </tr></thead>
              <tbody>
                {Object.entries(cashIn).map(([p,vals],i)=>{
                  const total=vals.reduce((a,b)=>a+b,0)
                  const pc=PLATFORMS.find(x=>x.name.toUpperCase()===p)?.color||C.neutral
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px"}}><Badge color={pc}>{p}</Badge></td>
                      {vals.map((v,j)=><td key={j} style={{padding:"8px 10px",color:v>0?C.positive:C.dimText,textAlign:"right" as const}}>{v>0?fmt(v,true):"—"}</td>)}
                      <td style={{padding:"8px 10px",color:C.positive,fontWeight:700,textAlign:"right" as const}}>{fmt(total,true)}</td>
                    </tr>
                  )
                })}
                <tr style={{background:C.positiveDim}}>
                  <td style={{padding:"9px 12px",color:C.positive,fontWeight:800}}>TOTAL IN</td>
                  {totalIn.map((v,j)=><td key={j} style={{padding:"9px 10px",color:C.positive,fontWeight:700,textAlign:"right" as const}}>{fmt(v,true)}</td>)}
                  <td style={{padding:"9px 10px",color:C.positive,fontWeight:800,textAlign:"right" as const}}>{fmt(totalIn.reduce((a,b)=>a+b,0),true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* Cash OUT table */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.negative}}/>
            <span style={{color:C.white,fontWeight:700,fontSize:13}}>Cash OUT — Expense Categories</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11,minWidth:900}}>
              <thead><tr style={{background:C.surfaceAlt}}>
                <th style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 12px",textAlign:"left" as const,minWidth:160}}>CATEGORY</th>
                {months.map(m=><th key={m} style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 10px",textAlign:"right" as const,whiteSpace:"nowrap" as const}}>{m}</th>)}
                <th style={{color:C.dimText,fontWeight:700,fontSize:9,padding:"8px 10px",textAlign:"right" as const}}>AVG/MTH</th>
              </tr></thead>
              <tbody>
                {Object.entries(cashOut).map(([cat,vals],i)=>{
                  const avg=vals.reduce((a,b)=>a+b,0)/(vals.length||1)
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px",color:C.neutral,fontSize:11}}>{cat}</td>
                      {vals.map((v,j)=><td key={j} style={{padding:"8px 10px",color:v<0?C.negative:C.dimText,textAlign:"right" as const}}>{v<0?fmt(-v,true):"—"}</td>)}
                      <td style={{padding:"8px 10px",color:C.negative,fontWeight:600,textAlign:"right" as const}}>{avg<0?fmt(-avg,true):"—"}</td>
                    </tr>
                  )
                })}
                <tr style={{background:C.negativeDim}}>
                  <td style={{padding:"9px 12px",color:C.negative,fontWeight:800}}>TOTAL OUT</td>
                  {totalOut.map((v,j)=><td key={j} style={{padding:"9px 10px",color:C.negative,fontWeight:700,textAlign:"right" as const}}>{fmt(-v,true)}</td>)}
                  <td style={{padding:"9px 10px",color:C.negative,fontWeight:800,textAlign:"right" as const}}>{fmt(-totalOut.reduce((a,b)=>a+b,0)/(totalOut.length||1),true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* Net row */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11,minWidth:900}}>
              <tbody>
                <tr style={{background:C.surfaceAlt}}>
                  <td style={{padding:"10px 12px",color:C.accent,fontWeight:800,fontSize:12,minWidth:160}}>NET CASH FLOW</td>
                  {netFlow.map((v,j)=>(
                    <td key={j} style={{padding:"10px 10px",color:v>=0?C.positive:C.negative,fontWeight:800,textAlign:"right" as const,whiteSpace:"nowrap" as const}}>
                      {v>=0?"+":""}{fmt(v,true)}
                    </td>
                  ))}
                  <td/>
                </tr>
                <tr>
                  <td style={{padding:"8px 12px",color:C.dimText,fontSize:11}}>Status</td>
                  {netFlow.map((v,j)=>(
                    <td key={j} style={{padding:"8px 10px",textAlign:"right" as const}}>
                      <Badge color={v>=0?C.positive:v>-1000000?C.accent:C.negative}>{v>=0?"+":v>-1000000?"~":"−"}</Badge>
                    </td>
                  ))}
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab,setTab]           = useState<"arap"|"pl"|"cf">("arap")
  const [platforms,setPlatforms] = useState<PlatformCalc[]>([])
  const [cfRows,setCfRows]     = useState<string[][]>([])
  const [loading,setLoading]   = useState(true)
  const [loadingMsg,setLoadingMsg] = useState("Fetching data...")
  const [error,setError]       = useState("")
  const [lastRefresh,setLastRefresh] = useState<Date|null>(null)
  const [dateFrom,setDateFrom] = useState("")
  const [dateTo,setDateTo]     = useState("")

  const fetchAll = useCallback(async (from?: Date, to?: Date) => {
    setLoading(true); setError("")
    try {
      // Fetch all platform tabs + CF sheet in parallel
      const platformFetches = PLATFORMS.map(p =>
        fetch(`${SHEET_BASE}?gid=${p.gid}&single=true&output=csv&t=${Date.now()}`)
          .then(r => r.text())
          .then(t => extractPlatformData(parseCSV(t), p.name, p.color, from, to))
      )
      const cfFetch = fetch(`${CF_URL}&t=${Date.now()}`).then(r=>r.text()).then(t=>parseCSV(t))

      setLoadingMsg(`Fetching ${PLATFORMS.length} platform tabs + cash flow...`)
      const [...results] = await Promise.all([...platformFetches, cfFetch])

      const pData = results.slice(0, PLATFORMS.length) as PlatformCalc[]
      const cf    = results[PLATFORMS.length] as string[][]

      setPlatforms(pData)
      setCfRows(cf)
      setLastRefresh(new Date())
    } catch(e:any) {
      setError("Sheet fetch failed — check publish settings or network.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Inter',-apple-system,sans-serif",color:C.white}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:32,height:32,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🍛</div>
            <div>
              <div style={{fontWeight:800,fontSize:15,letterSpacing:-0.3}}>CURRYiT Finance</div>
              <div style={{color:C.dimText,fontSize:10,letterSpacing:1}}>
                HOMECHEF INDIA VENTURES · {loading?"Syncing...":lastRefresh?`Updated ${lastRefresh.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`:"—"}
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px"}}>
              <span style={{color:C.dimText,fontSize:11}}>From</span>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{background:"transparent",border:"none",color:C.white,fontSize:12,outline:"none",colorScheme:"dark"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px"}}>
              <span style={{color:C.dimText,fontSize:11}}>To</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{background:"transparent",border:"none",color:C.white,fontSize:12,outline:"none",colorScheme:"dark"}}/>
            </div>
            {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");fetchAll()}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.negative,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✕ Clear</button>}
            <button onClick={()=>fetchAll(dateFrom?new Date(dateFrom):undefined,dateTo?new Date(dateTo):undefined)} disabled={loading} style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,color:loading?C.dimText:C.accent,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:loading?"not-allowed":"pointer",fontWeight:600}}>
              {loading?"⟳ Syncing...":"⟳ Refresh"}
            </button>
            <div style={{display:"flex",gap:6,background:C.surfaceAlt,padding:4,borderRadius:10}}>
              <NavTab label="AR / AP" active={tab==="arap"} onClick={()=>setTab("arap")}/>
              <NavTab label="P & L"   active={tab==="pl"}   onClick={()=>setTab("pl")}/>
              <NavTab label="Cash Flow" active={tab==="cf"} onClick={()=>setTab("cf")}/>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"20px 16px"}}>
        {error && <div style={{background:C.negativeDim,border:`1px solid ${C.negative}44`,borderRadius:10,padding:"12px 16px",marginBottom:16,color:C.negative,fontSize:13}}>⚠ {error}</div>}
        {loading && (
          <div style={{textAlign:"center" as const,padding:60,color:C.dimText}}>
            <div style={{fontSize:32,marginBottom:12,animation:"spin 1s linear infinite"}}>⟳</div>
            <div>{loadingMsg}</div>
            <div style={{fontSize:11,marginTop:8}}>Fetching {PLATFORMS.length} platform tabs from Google Sheets...</div>
          </div>
        )}
        {!loading && platforms.length>0 && (
          <>
            {tab==="arap" && <ARAPTab platforms={platforms}/>}
            {tab==="pl"   && <PLTab/>}
            {tab==="cf"   && <CFTab cfRows={cfRows}/>}
          </>
        )}
      </div>

      <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 20px",textAlign:"center" as const}}>
        <span style={{color:C.dimText,fontSize:10,letterSpacing:1}}>LIVE · {PLATFORMS.length} PLATFORM TABS · GOOGLE SHEETS · REFRESH ON LOAD</span>
      </div>
    </div>
  )
}
