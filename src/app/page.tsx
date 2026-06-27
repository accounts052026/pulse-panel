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

function extractPlatformData(rows: string[][], name: string, color: string): PlatformCalc {
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
  const [view,setView] = useState<"waterfall"|"platforms"|"aging">("waterfall")
  const [selP,setSelP] = useState<string|null>(null)

  const totAR4 = platforms.reduce((s,p)=>s+p.ar4,0)
  const totAP4 = platforms.reduce((s,p)=>s+p.ap4,0)
  const totNet = totAR4+totAP4
  const totBFD = platforms.reduce((s,p)=>s+p.bfd,0)
  const totInv = platforms.reduce((s,p)=>s+p.invoice,0)

  // Build waterfall from platform totals
  const wf = [
    {label:"INVOICE",          ar:platforms.reduce((s,p)=>s+p.invoice,0),   ap:platforms.reduce((s,p)=>s+p.apInvoice,0)},
    {label:"RETURNS",          ar:platforms.reduce((s,p)=>s+p.returns,0),   ap:null},
    {label:"NET SALES",        ar:platforms.reduce((s,p)=>s+p.netSales,0),  ap:null, divider:true},
    {label:"PAYMENT",          ar:platforms.reduce((s,p)=>s+p.payment,0),   ap:platforms.reduce((s,p)=>s+p.apPayment,0)},
    {label:"AR1 / AP1",        ar:platforms.reduce((s,p)=>s+p.ar1,0),       ap:platforms.reduce((s,p)=>s+p.ap1,0), highlight:true},
    {label:"TDS",              ar:platforms.reduce((s,p)=>s+p.tds,0),       ap:platforms.reduce((s,p)=>s+p.tdsDed,0)},
    {label:"AR2 / AP2",        ar:platforms.reduce((s,p)=>s+p.ar2,0),       ap:platforms.reduce((s,p)=>s+p.ap2,0), highlight:true},
    {label:"BRAND FUNDED DISC",ar:platforms.reduce((s,p)=>s+p.bfd,0),       ap:platforms.reduce((s,p)=>s+p.debitNote,0)},
    {label:"AR3 / AP3",        ar:platforms.reduce((s,p)=>s+p.ar3,0),       ap:platforms.reduce((s,p)=>s+p.ap3,0), highlight:true},
    {label:"AR/AP ADJUSTMENTS",ar:platforms.reduce((s,p)=>s+p.adjustments,0),ap:platforms.reduce((s,p)=>s+p.apAdj,0)},
    {label:"AR4 / AP4 (FINAL)",ar:totAR4, ap:totAP4, highlight:true, final:true},
  ]

  const selData = selP ? platforms.find(p=>p.name===selP) : null

  return (
    <div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
        <KpiCard label="AR4 — Total Receivable" value={fmt(totAR4,true)} sub="After BFD & adjustments" color={C.positive}/>
        <KpiCard label="AP4 — Total Payable" value={fmt(Math.abs(totAP4),true)} sub="Platform fees & charges" color={C.negative}/>
        <KpiCard label="Net Position" value={fmt(totNet,true)} sub="AR4 − AP4" color={totNet>=0?C.positive:C.negative}/>
        <KpiCard label="Total Invoice" value={fmt(totInv,true)} sub="Gross invoiced across platforms" color={C.accent}/>
        <KpiCard label="Brand Funded Disc" value={fmt(Math.abs(totBFD),true)} sub="Total BFD setoff" color={C.neutral}/>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        {(["waterfall","platforms","aging"] as const).map(v=>(
          <NavTab key={v} label={v==="waterfall"?"Waterfall":v==="platforms"?"By Platform":"AR Aging"} active={view===v} onClick={()=>setView(v)}/>
        ))}
      </div>

      {view==="waterfall" && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",borderBottom:`1px solid ${C.border}`,padding:"10px 16px",background:C.surfaceAlt}}>
            {["LINE ITEM","ACCOUNTS RECEIVABLE","ACCOUNTS PAYABLE"].map(h=>(
              <div key={h} style={{color:C.dimText,fontSize:10,fontWeight:700,letterSpacing:1}}>{h}</div>
            ))}
          </div>
          {wf.map((row,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"10px 16px",background:row.final?C.accentDim:row.highlight?C.surfaceAlt:"transparent",borderBottom:`1px solid ${C.border}`,borderTop:row.divider?`1px solid ${C.accent}44`:"none"}}>
              <div style={{color:row.final?C.accent:row.highlight?C.white:C.neutral,fontSize:12,fontWeight:row.final||row.highlight?700:400}}>{row.label}</div>
              <div style={{color:(row.ar??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>
                {row.ar===null?"—":fmt(row.ar??0)}
              </div>
              <div style={{color:row.ap===null?C.dimText:(row.ap??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>
                {row.ap===null?"—":fmt(row.ap??0)}
              </div>
            </div>
          ))}
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"12px 16px",background:C.accentDim}}>
            <div style={{color:C.accent,fontSize:12,fontWeight:800}}>NET POSITION</div>
            <div style={{color:totNet>=0?C.positive:C.negative,fontSize:12,fontWeight:800}}>{fmt(totNet)}</div>
            <div style={{color:C.dimText,fontSize:11}}>AR4 − |AP4|</div>
          </div>
        </div>
      )}

      {view==="platforms" && (
        <div>
          {/* Platform selector */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            <button onClick={()=>setSelP(null)} style={{background:selP===null?C.accent:"transparent",color:selP===null?"#0B0F1A":C.neutral,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>All</button>
            {platforms.map(p=>(
              <button key={p.name} onClick={()=>setSelP(p.name===selP?null:p.name)} style={{background:selP===p.name?p.color+"33":"transparent",color:selP===p.name?p.color:C.neutral,border:`1px solid ${selP===p.name?p.color:C.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>{p.name}</button>
            ))}
          </div>

          {selData ? (
            // Single platform waterfall
            <div style={{background:C.surface,border:`1px solid ${selData.color}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,background:selData.color+"11",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:selData.color,fontWeight:800,fontSize:16}}>{selData.name}</span>
                <Badge color={selData.net>=0?C.positive:C.negative}>{selData.net>=0?"NET +VE":"NET −VE"}</Badge>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"8px 16px",background:C.surfaceAlt,borderBottom:`1px solid ${C.border}`}}>
                {["LINE ITEM","AR","AP"].map(h=><div key={h} style={{color:C.dimText,fontSize:9,fontWeight:700,letterSpacing:1}}>{h}</div>)}
              </div>
              {[
                {label:"Invoice",ar:selData.invoice,ap:selData.apInvoice},
                {label:"Returns",ar:selData.returns,ap:null},
                {label:"Net Sales",ar:selData.netSales,ap:null,divider:true},
                {label:"Payment",ar:selData.payment,ap:selData.apPayment},
                {label:"AR1 / AP1",ar:selData.ar1,ap:selData.ap1,highlight:true},
                {label:"TDS",ar:selData.tds,ap:selData.tdsDed},
                {label:"AR2 / AP2",ar:selData.ar2,ap:selData.ap2,highlight:true},
                {label:"Brand Funded Disc",ar:selData.bfd,ap:selData.debitNote},
                {label:"AR3 / AP3",ar:selData.ar3,ap:selData.ap3,highlight:true},
                {label:"AR/AP Adjustments",ar:selData.adjustments,ap:selData.apAdj},
                {label:"AR4 / AP4 (FINAL)",ar:selData.ar4,ap:selData.ap4,highlight:true,final:true},
              ].map((row,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"9px 16px",background:row.final?C.accentDim:row.highlight?C.surfaceAlt:"transparent",borderBottom:`1px solid ${C.border}`,borderTop:row.divider?`1px solid ${C.accent}44`:"none"}}>
                  <div style={{color:row.final?C.accent:row.highlight?C.white:C.neutral,fontSize:12,fontWeight:row.final||row.highlight?700:400}}>{row.label}</div>
                  <div style={{color:(row.ar??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>{row.ar===null?"—":fmt(row.ar??0)}</div>
                  <div style={{color:row.ap===null?C.dimText:(row.ap??0)>=0?C.positive:C.negative,fontSize:12,fontWeight:row.final?700:500}}>{row.ap===null?"—":fmt(row.ap??0)}</div>
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr",padding:"12px 16px",background:C.accentDim}}>
                <div style={{color:C.accent,fontWeight:800,fontSize:12}}>NET</div>
                <div style={{color:selData.net>=0?C.positive:C.negative,fontWeight:800,fontSize:12}}>{fmt(selData.net)}</div>
                <div/>
              </div>
            </div>
          ) : (
            // All platforms grid
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
              {platforms.map((p,i)=>(
                <div key={i} onClick={()=>setSelP(p.name)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:18,borderLeft:`3px solid ${p.color}`,cursor:"pointer",transition:"border-color 0.15s"}} onMouseEnter={e=>(e.currentTarget.style.borderColor=p.color)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{color:p.color,fontWeight:800,fontSize:15}}>{p.name}</div>
                    <Badge color={p.net>=0?C.positive:C.negative}>{p.net>=0?"NET +VE":"NET −VE"}</Badge>
                  </div>
                  {[
                    {label:"Invoice",val:p.invoice,color:C.neutral},
                    {label:"BFD Setoff",val:p.bfd,color:C.accent},
                    {label:"AR4",val:p.ar4,color:C.positive},
                    {label:"AP4",val:p.ap4,color:C.negative},
                  ].map((r,j)=>(
                    <div key={j} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{color:C.dimText,fontSize:11}}>{r.label}</span>
                      <span style={{color:r.color,fontSize:12,fontWeight:600}}>{fmt(r.val,true)}</span>
                    </div>
                  ))}
                  <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:C.dimText,fontSize:11,fontWeight:700}}>NET</span>
                    <span style={{color:p.net>=0?C.positive:C.negative,fontSize:13,fontWeight:800}}>{fmt(p.net,true)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view==="aging" && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{color:C.neutral,fontSize:13}}>AR Aging data comes from InsightBoard tab — add aging columns to individual platform tabs to enable this view.</div>
        </div>
      )}
    </div>
  )
}

// ─── P&L TAB (static from Zoho PDF) ─────────────────────────────────────────
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
  const [view,setView]=useState<"annual"|"opex">("annual")

  return (
    <div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
        <KpiCard label="FY26 Gross Sales" value={fmt(fy26.sales,true)} sub={`↑ from ${fmt(fy25.sales,true)} FY25`} color={C.positive}/>
        <KpiCard label="Gross Margin FY26" value={pct(fy26.grossProfit,fy26.netSales)} sub={`${pct(fy25.grossProfit,fy25.netSales)} in FY25`} color={C.accent}/>
        <KpiCard label="EBITDA FY26" value={fmt(fy26.ebitda,true)} sub="Operating loss" color={C.negative}/>
        <KpiCard label="Gross Profit FY26" value={fmt(fy26.grossProfit,true)} sub={`↑ 2x from ${fmt(fy25.grossProfit,true)}`} color={C.positive}/>
      </div>
      <div style={{padding:"8px 12px",background:C.accentDim,borderRadius:8,marginBottom:16}}>
        <span style={{color:C.accent,fontSize:11}}>ℹ P&L from Zoho Books provisional export — update when new monthly data available</span>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        <NavTab label="Annual Compare" active={view==="annual"} onClick={()=>setView("annual")}/>
        <NavTab label="OpEx Breakdown" active={view==="opex"} onClick={()=>setView("opex")}/>
      </div>
      {view==="annual" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {([["FY 2024-25",fy25],["FY 2025-26",fy26]] as const).map(([label,d]:any,idx)=>(
            <div key={idx} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:`3px solid ${idx===1?C.accent:C.border}`}}>
              <div style={{color:idx===1?C.accent:C.neutral,fontWeight:800,fontSize:14,marginBottom:16}}>{label}</div>
              {[
                {label:"Gross Sales",val:d.sales,color:C.white,bold:true},
                {label:"Discounts & Trade",val:d.discounts,color:C.negative},
                {label:"Net Revenue",val:d.netSales,color:C.white,bold:true},
                {label:"Cost of Goods Sold",val:-d.cogs,color:C.negative},
                {label:"Gross Profit",val:d.grossProfit,color:C.positive,bold:true},
                {label:"Gross Margin %",val:pct(d.grossProfit,d.netSales),color:C.accent,isStr:true},
                {label:"Operating Expenses",val:-d.opex,color:C.negative},
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
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
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

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("")
    try {
      // Fetch all platform tabs + CF sheet in parallel
      const platformFetches = PLATFORMS.map(p =>
        fetch(`${SHEET_BASE}?gid=${p.gid}&single=true&output=csv&t=${Date.now()}`)
          .then(r => r.text())
          .then(t => extractPlatformData(parseCSV(t), p.name, p.color))
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
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={fetchAll} disabled={loading} style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,color:loading?C.dimText:C.accent,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:loading?"not-allowed":"pointer",fontWeight:600}}>
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
