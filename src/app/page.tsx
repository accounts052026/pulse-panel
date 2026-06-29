"use client"
import { useState, useEffect, useCallback } from "react"

// ─── SHEET CONFIG ─────────────────────────────────────────────────────────────
const SHEET_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQic7FAazD2oLAIGRxBT8QGyAbM9pChIruIhS8PtdtcBhuD8c9B0k0EbFG5_duCdkNksq_dxyRF8sM3/pub"
const CF_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2B28C8WnJefHbWfpn3B2lLG6fDn14sjeFOGRZqQ83Be0F5WUwU5LPm1Z1S0OLpNns6P_NgaSWIRsr/pub?output=csv"
const WC_URL      = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2B28C8WnJefHbWfpn3B2lLG6fDn14sjeFOGRZqQ83Be0F5WUwU5LPm1Z1S0OLpNns6P_NgaSWIRsr/pub?gid=1354185061&single=true&output=csv"
const BANK_URL    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2B28C8WnJefHbWfpn3B2lLG6fDn14sjeFOGRZqQ83Be0F5WUwU5LPm1Z1S0OLpNns6P_NgaSWIRsr/pub?gid=1112489118&single=true&output=csv"

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
  bg:          "#F5F7FA",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F0F2F6",
  border:      "#E2E8F0",
  accent:      "#E07B00",
  accentDim:   "#F5A62318",
  positive:    "#16A34A",
  positiveDim: "#16A34A12",
  negative:    "#DC2626",
  negativeDim: "#DC262610",
  neutral:     "#475569",
  white:       "#0F172A",
  dimText:     "#64748B",
}


// ─── VENDOR / EXPENSE MASTER ─────────────────────────────────────────────────
type Criticality = "CRITICAL" | "MEDIUM" | "LOW" | "ONE-TIME" | "BAND"

interface VendorMaster {
  canonical: string      // display name
  category: string       // grouping category
  critical: Criticality  // can we stop paying?
  note: string
}

const VENDOR_MASTER: Record<string, VendorMaster> = {
  // ── SALARIES ──
  "Salaries and Employee Wages":        {canonical:"Salaries & Wages",       category:"SALARIES",    critical:"CRITICAL",  note:"Core team payroll"},
  "Salary Payable":                     {canonical:"Salaries & Wages",       category:"SALARIES",    critical:"CRITICAL",  note:"Payroll (accrued)"},
  "Salaries and employee wages":        {canonical:"Salaries & Wages",       category:"SALARIES",    critical:"CRITICAL",  note:"Core team payroll"},

  // ── RAW MATERIAL ──
  "AMIT VEGETABLES":                    {canonical:"Amit Vegetables",        category:"RAW MATERIAL",critical:"CRITICAL",  note:"Sabziwala — cannot stop"},
  "Amit Vegetables":                    {canonical:"Amit Vegetables",        category:"RAW MATERIAL",critical:"CRITICAL",  note:"Sabziwala — cannot stop"},
  "NAVEEN GENERAL STORE":               {canonical:"Naveen General Store",   category:"RAW MATERIAL",critical:"CRITICAL",  note:"Masala & spices — cannot stop"},
  "SSV KISAN BANDHU":                   {canonical:"SSV Kisan Bandhu",       category:"RAW MATERIAL",critical:"CRITICAL",  note:"RM processing"},
  "Raw Material and Kitchen Expenses":  {canonical:"Raw Material (Direct)",  category:"RAW MATERIAL",critical:"CRITICAL",  note:"Direct RM purchases"},
  "Gajendra":                           {canonical:"Gajendra (Gas)",         category:"RAW MATERIAL",critical:"CRITICAL",  note:"Gas supplier"},

  // ── PACKAGING ──
  "FOODPRO PACKAGING PRIVATE LIMITED":  {canonical:"Foodpro Packaging",      category:"PACKAGING",   critical:"CRITICAL",  note:"Inner pouches — cannot stop"},
  "Foodpro Packaging Private Limited":  {canonical:"Foodpro Packaging",      category:"PACKAGING",   critical:"CRITICAL",  note:"Inner pouches — cannot stop"},
  "TURTLE MEDIA PRIVATE LIMITED":       {canonical:"Turtle Media",           category:"PACKAGING",   critical:"CRITICAL",  note:"Outer pouches — cannot stop"},
  "Turtle Media Private Limited":       {canonical:"Turtle Media",           category:"PACKAGING",   critical:"CRITICAL",  note:"Outer pouches — cannot stop"},
  "Vikas packaging":                    {canonical:"Vikas/Narayani (Cartons)",category:"PACKAGING",  critical:"CRITICAL",  note:"Carton boxes — cannot stop"},
  "NARAYANI ENTERPRISES":               {canonical:"Vikas/Narayani (Cartons)",category:"PACKAGING",  critical:"CRITICAL",  note:"Same as Vikas — cannot stop"},
  "Label Inc":                          {canonical:"Label Inc (Labels)",      category:"PACKAGING",   critical:"MEDIUM",    note:"Labels & stickers — 2 months cycle"},
  "Mr Print":                           {canonical:"Mr Print",               category:"PACKAGING",   critical:"BAND",      note:"Replaced by Turtle Media"},

  // ── RETORT PROCESSING ──
  "RIVI INTERNATIONAL FOOD LLP":        {canonical:"Rivi/SRK (Retort)",      category:"RETORT",      critical:"CRITICAL",  note:"Same entity as SRK — cannot stop"},
  "SRK INTERNATIONAL FOOD (SHIVANI)":   {canonical:"Rivi/SRK (Retort)",      category:"RETORT",      critical:"CRITICAL",  note:"Same entity as Rivi — cannot stop"},
  "NEELKANTH R & D RETORTS":            {canonical:"Neelkanth (Machinery)",  category:"MACHINERY",   critical:"ONE-TIME",  note:"Machinery purchase only"},

  // ── LOGISTICS ──
  "MOVIN EXPRESS PRIVATE LIMITED":      {canonical:"Movin Express",          category:"LOGISTICS",   critical:"CRITICAL",  note:"Platform WH dispatch — cannot stop"},
  "Movin Express Private Limited":      {canonical:"Movin Express",          category:"LOGISTICS",   critical:"CRITICAL",  note:"Platform WH dispatch — cannot stop"},
  "Shiprocket Private Limited Delhi (AAEC)":{canonical:"Shiprocket",         category:"LOGISTICS",   critical:"CRITICAL",  note:"Amazon logistics — cannot stop"},
  "S2 LOGISTICS":                       {canonical:"S2 Logistics",           category:"LOGISTICS",   critical:"CRITICAL",  note:"Amazon shipments"},
  "AMIT TRANSPORT COMPANY":             {canonical:"Amit Transport",         category:"LOGISTICS",   critical:"BAND",      note:"Band ho gaya"},
  "Rajesh Transport":                   {canonical:"Rajesh Transport",       category:"LOGISTICS",   critical:"BAND",      note:"Band ho gaya"},
  "Internal Logistic Expenses":         {canonical:"Internal Logistics",     category:"LOGISTICS",   critical:"MEDIUM",    note:"Internal movement"},

  // ── MARKETING ──
  "BLINK COMMERCE PRIVATE LIMITED":     {canonical:"Blinkit Ads (Blink Commerce)",category:"MARKETING",critical:"MEDIUM", note:"Blinkit platform ads"},
  "Blink Commerce Private Limited":     {canonical:"Blinkit Ads (Blink Commerce)",category:"MARKETING",critical:"MEDIUM", note:"Blinkit platform ads"},
  "Marketing - Discretionary Brand Spends":{canonical:"Brand Marketing",    category:"MARKETING",   critical:"MEDIUM",    note:"Can reduce in crunch"},
  "Advertising And Marketing":          {canonical:"Advertising & Marketing",category:"MARKETING",   critical:"MEDIUM",    note:"Platform ads"},
  "KWAZI DESIGN LLP":                   {canonical:"Kwazi Design (Agency)",  category:"MARKETING",   critical:"LOW",       note:"Can stop in crunch"},
  "TURTLE MEDIA":                       {canonical:"Turtle Media (Mktg)",    category:"MARKETING",   critical:"LOW",       note:"Marketing work"},
  "DAKSHITA FINSHARK VENTURES":         {canonical:"Vandana (Consultant)",   category:"MARKETING",   critical:"LOW",       note:"Can stop"},
  "PLANOUT GROUP PRIVATE LIMITED":      {canonical:"Marketing Agency",       category:"MARKETING",   critical:"LOW",       note:"Can stop"},
  "B2C Cred Sales 23-26":               {canonical:"Cred (D2C)",             category:"PLATFORM IN", critical:"MEDIUM",    note:"Cred orders"},

  // ── RENT ──
  "Arun Kumar Rent_Warehouse_Jonapur":  {canonical:"Warehouse Rent (Jonapur)",category:"RENT",       critical:"CRITICAL",  note:"₹1L/month — cannot stop"},
  "Monika Banga Rent_Office_Vasant Kunj":{canonical:"Office Rent (VK)",      category:"RENT",        critical:"CRITICAL",  note:"Cannot stop"},
  "Harish Mehlawat Rent_Warehouse_Vasant Kunj":{canonical:"Kitchen Rent (VK, Old)",category:"RENT",  critical:"BAND",      note:"Old kitchen — band"},
  "Bulbul Mehla Rent_D7_Vasant Kunj":   {canonical:"Old WH Rent (D7, Band)", category:"RENT",        critical:"BAND",      note:"Old warehouse — band"},
  "Cash Rent_Kitchen_Vasant kunj":      {canonical:"Cash Kitchen Rent (Band)",category:"RENT",       critical:"BAND",      note:"Old kitchen cash rent"},
  "Rent Expense":                       {canonical:"Rent",                   category:"RENT",        critical:"CRITICAL",  note:"Rent payments"},

  // ── INSURANCE ──
  "Onsurity Technologies Private Limited":{canonical:"Onsurity (Insurance)", category:"INSURANCE",   critical:"CRITICAL",  note:"Employee health insurance"},

  // ── REPAIR & MAINTENANCE ──
  "Repairs and Maintenance":            {canonical:"Repairs & Maintenance",  category:"R&M",         critical:"MEDIUM",    note:"General maintenance"},
  "TECH T SOLUTION":                    {canonical:"Tech T (Electrician)",   category:"R&M",         critical:"MEDIUM",    note:"Abdul — repair work"},
  "RS INDUSTRIES":                      {canonical:"RS Industries (Machinery)",category:"R&M",        critical:"LOW",       note:"Not often"},

  // ── LOAN ──
  "Loan Interest":                      {canonical:"Loan Interest (Bajaj)",  category:"LOAN",        critical:"CRITICAL",  note:"Cannot stop"},
  "Finance Charges":                    {canonical:"Finance Charges",        category:"LOAN",        critical:"CRITICAL",  note:"Cannot stop"},
  "BAJAJ FINANCE LIMITED":              {canonical:"Bajaj Finance (EMI)",    category:"LOAN",        critical:"CRITICAL",  note:"Cannot stop"},

  // ── PROFESSIONAL ──
  "Vantage Law Advisors":               {canonical:"Legal (Vantage Law)",    category:"PROFESSIONAL",critical:"LOW",       note:"Legal services"},
  "GOOGLE INDIA PRIVATE LIMITED":       {canonical:"Google (Software/Ads)",  category:"PROFESSIONAL",critical:"LOW",       note:"Google services"},
  "Software Expense":                   {canonical:"Software",               category:"PROFESSIONAL",critical:"MEDIUM",    note:"Tools & subscriptions"},

  // ── UTILITIES ──
  "Electricity expenses":               {canonical:"Electricity",            category:"UTILITIES",   critical:"CRITICAL",  note:"Cannot stop"},
  "Water Expense":                      {canonical:"Water",                  category:"UTILITIES",   critical:"CRITICAL",  note:"Cannot stop"},

  // ── CAPEX / ONE-TIME ──
  "DUCTOFAB":                           {canonical:"Ductofab (Construction)",    category:"CAPEX",       critical:"ONE-TIME",  note:"One-time construction only"},
  "SHREE GANESH STEEL":                 {canonical:"Shree Ganesh (Steel)",       category:"CAPEX",       critical:"ONE-TIME",  note:"One-time only"},
  "NK IMPEX":                           {canonical:"NK Impex (Packing Material)",category:"CAPEX",       critical:"ONE-TIME",  note:"One-time packing material"},
  "TRUMAX ENGINEERS":                   {canonical:"Trumax (Machinery)",          category:"CAPEX",       critical:"ONE-TIME",  note:"Machinery — not often"},
  "ABSOLUTE RG EQUIPMENT":              {canonical:"Absolute RG (Machine Parts)",category:"CAPEX",       critical:"ONE-TIME",  note:"Spare parts — not often"},

  // ── CONSULTANTS (one-time/rare) ──
  "POOJA PAWA":                         {canonical:"Pooja Pawa (Consultant)",    category:"PROFESSIONAL",critical:"ONE-TIME",  note:"One-time consultant"},
  "Megha":                              {canonical:"Megha (Mktg Consultant)",    category:"MARKETING",   critical:"ONE-TIME",  note:"One-time marketing consultant"},
  "VANDANA":                            {canonical:"Vandana (Mktg — Optional)",  category:"MARKETING",   critical:"LOW",       note:"Marketing — skip in crunch"},
  "Blue Bell":                          {canonical:"Blue Bell (Travel Agency)",  category:"ADMIN",       critical:"LOW",       note:"Travel booking — skip in crunch"},
  "Equinox":                            {canonical:"Equinox (FSSAI Testing)",    category:"PROFESSIONAL",critical:"MEDIUM",    note:"Food testing — needed for NPD"},
  "NAVEEN GENERAL STORE_old":           {canonical:"Naveen General Store",       category:"RAW MATERIAL",critical:"CRITICAL",  note:"Masala & spices"},
  
  // ── OTHER ──
  "Admin Expenses":                     {canonical:"Admin Expenses",         category:"ADMIN",       critical:"LOW",       note:"Misc admin"},
  "Office expenses":                    {canonical:"Office Expenses",        category:"ADMIN",       critical:"LOW",       note:"Office misc"},
  "Staff & Welfare Expense":            {canonical:"Staff Welfare",          category:"ADMIN",       critical:"LOW",       note:"Team welfare"},
  "Hosting & Welfare":                  {canonical:"Hosting & Welfare",      category:"ADMIN",       critical:"LOW",       note:"Team hosting"},
  "Other Expenses":                     {canonical:"Other Expenses",         category:"ADMIN",       critical:"LOW",       note:"Miscellaneous"},
  "Bank Fees and Charges":              {canonical:"Bank Charges",           category:"ADMIN",       critical:"CRITICAL",  note:"Bank fees"},
  "Tour & Travel - Foreign & Domestic": {canonical:"Travel",                 category:"ADMIN",       critical:"LOW",       note:"Can reduce"},
  "Mishita Enterprises":                {canonical:"Mishita (Band)",         category:"LOGISTICS",   critical:"BAND",      note:"Internal logistics — discontinued"},
  "UNI OVERSEAS":                       {canonical:"Uni Overseas (Vendor)",  category:"PACKAGING",   critical:"LOW",       note:"Occasional vendor"},
  "Nischal Naidu Kandula Reimbursement":{canonical:"Ads Reimbursement",      category:"MARKETING",   critical:"MEDIUM",    note:"Ads reimbursement"},
  "Food Testing Expense":               {canonical:"Food Testing (FSSAI)",   category:"PROFESSIONAL",critical:"MEDIUM",    note:"FSSAI/NPD testing"},
  "Kitchen Supplies":                   {canonical:"Kitchen Supplies",       category:"RAW MATERIAL",critical:"MEDIUM",    note:"Kitchen ops"},
  "Factory Supplies":                   {canonical:"Factory Supplies",       category:"RAW MATERIAL",critical:"MEDIUM",    note:"Factory consumables"},
  "Packing and Printing Expenses - Secondary":{canonical:"Secondary Packaging",category:"PACKAGING",  critical:"CRITICAL",  note:"Secondary packaging"},
  "Civil and Maintenance":              {canonical:"Civil Work",             category:"CAPEX",       critical:"ONE-TIME",  note:"Construction/civil"},
  "Printing and Stationery":            {canonical:"Printing & Stationery",  category:"ADMIN",       critical:"LOW",       note:"Office stationery"},
  "Commission-F":                       {canonical:"Commission",             category:"ADMIN",       critical:"LOW",       note:"Commission payments"},
  "GST Expense":                        {canonical:"GST Expense",            category:"ADMIN",       critical:"CRITICAL",  note:"GST payments"},
  "Telephone Expense":                  {canonical:"Telephone/WiFi",         category:"UTILITIES",   critical:"MEDIUM",    note:"Internet & phone"},
  "IT and Internet Expenses":           {canonical:"Software & IT",          category:"PROFESSIONAL",critical:"MEDIUM",    note:"IT tools"},

  // ── PLATFORM RECEIPTS (CASH IN) ──
  "Moonstone Ventures LLP":             {canonical:"Blinkit",                category:"PLATFORM IN", critical:"CRITICAL",  note:"Blinkit entity 1"},
  "ASVAH RETAIL PRIVATE LIMITED":       {canonical:"Blinkit",                category:"PLATFORM IN", critical:"CRITICAL",  note:"Blinkit entity 2"},
  "Scootsy Logistics Private Ltd":      {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "PJTJ TECHNOLOGIES PRIVATE LIMITED":  {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "MOKSH ENTERPRISES PRIVATE LIMITED":  {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "CLOUDSTORE RETAIL PRIVATE LIMITED":  {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "CLOUDKART VENTURES PRIVATE LIMITED": {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "JUPITER KART PRIVATE LIMITED":       {canonical:"Swiggy",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Swiggy entity"},
  "KIRANAKART TECHNOLOGIES PRIVATE LIMITED":{canonical:"Zepto",              category:"PLATFORM IN", critical:"CRITICAL",  note:"Zepto entity"},
  "Zepto Limited":                      {canonical:"Zepto",                  category:"PLATFORM IN", critical:"CRITICAL",  note:"Zepto"},
  "Zepto Private Limited":              {canonical:"Zepto",                  category:"PLATFORM IN", critical:"CRITICAL",  note:"Zepto"},
  "INNOVATIVE RETAIL CONCEPTS PRIVATE LIMITED":{canonical:"BigBasket",       category:"PLATFORM IN", critical:"CRITICAL",  note:"BigBasket entity"},
  "NATURES BASKET LIMITED":             {canonical:"BigBasket/NB",           category:"PLATFORM IN", critical:"MEDIUM",    note:"Natures Basket"},
  "FIRSTCLUB TECHNOLOGY PRIVATE LIMITED":{canonical:"FirstClub",             category:"PLATFORM IN", critical:"MEDIUM",    note:"FirstClub"},
  "B2C Customer Shopify":               {canonical:"D2C (Shopify)",          category:"PLATFORM IN", critical:"MEDIUM",    note:"Direct to consumer"},
  "B2B/B2C Amazon":                     {canonical:"Amazon",                 category:"PLATFORM IN", critical:"CRITICAL",  note:"Amazon marketplace"},
  "Amazon USA Sales":                   {canonical:"Amazon (Export)",        category:"PLATFORM IN", critical:"MEDIUM",    note:"Amazon USA"},
  "B2C Cred Sales 26-27":               {canonical:"Cred (D2C)",             category:"PLATFORM IN", critical:"MEDIUM",    note:"Cred orders"},
  "11 Seven Group":                     {canonical:"11 Seven (B2B)",         category:"PLATFORM IN", critical:"MEDIUM",    note:"B2B customer"},
  "GOGLOCAL PRIVATE LIMITED":           {canonical:"GoGlocal",               category:"PLATFORM IN", critical:"MEDIUM",    note:"GoGlocal platform"},
  "Marche Retail Pvt Ltd":              {canonical:"LeMarche",               category:"PLATFORM IN", critical:"MEDIUM",    note:"LeMarche"},
}

const CATEGORY_ORDER = [
  "SALARIES","RAW MATERIAL","PACKAGING","RETORT","LOGISTICS",
  "MARKETING","RENT","INSURANCE","LOAN","UTILITIES",
  "R&M","PROFESSIONAL","ADMIN","CAPEX","OTHER","MACHINERY","PLATFORM IN"
]

const CRITICAL_COLOR: Record<Criticality, string> = {
  "CRITICAL":  "#DC2626",   // Cannot stop — red
  "MEDIUM":    "#D97706",   // Important but can reduce — amber
  "LOW":       "#64748B",   // Can stop in crunch — grey
  "ONE-TIME":  "#8B5CF6",   // One-time payment — purple
  "BAND":      "#94A3B8",   // Already stopped — light grey
}

const CRITICAL_LABEL: Record<Criticality, string> = {
  "CRITICAL": "Must Pay", "MEDIUM": "Important", "LOW": "Optional",
  "ONE-TIME": "One-Time", "BAND": "Closed",
}

function getVendorInfo(name: string): VendorMaster {
  // Exact match first
  if(VENDOR_MASTER[name]) return VENDOR_MASTER[name]
  // Partial match
  const lower = name.toLowerCase()
  for(const [key,val] of Object.entries(VENDOR_MASTER)){
    if(lower.includes(key.toLowerCase())||key.toLowerCase().includes(lower)) return val
  }
  return {canonical:name, category:"OTHER", critical:"LOW", note:""}
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

      {/* ── ALL YEARS TABLE — rows=metrics, cols=FY ── */}
      {view==="annual" && (()=>{
        // All values in ₹ Lakhs
        const yrs = [
          {fy:"FY21", sales:2.35,   disc:0,      netSales:2.35,  cogs:0,     gp:2.35,   empBen:3.60,  advMkt:0,      logistics:0,    rent:0,     otherOpex:6.64,  totalOpex:10.24, ebitda:-7.89},
          {fy:"FY22", sales:14.62,  disc:0,      netSales:14.61, cogs:0,     gp:14.62,  empBen:8.38,  advMkt:14.74,  logistics:0.75, rent:0,     otherOpex:9.96,  totalOpex:33.83, ebitda:-32.53},
          {fy:"FY23", sales:40.67,  disc:0,      netSales:40.67, cogs:0,     gp:40.67,  empBen:26.81, advMkt:40.73,  logistics:7.75, rent:0,     otherOpex:66.35, totalOpex:141.64,ebitda:-100.97},
          {fy:"FY24", sales:89.08,  disc:0,      netSales:88.58, cogs:0,     gp:89.08,  empBen:38.00, advMkt:74.15,  logistics:26.84,rent:0,     otherOpex:88.12, totalOpex:227.11,ebitda:-138.03},
          {fy:"FY25", sales:614.92, disc:224.90, netSales:393.40,cogs:232.45,gp:160.96, empBen:82.82, advMkt:215.71, logistics:31.79,rent:13.17, otherOpex:400.32,totalOpex:744.81,ebitda:-350.05},
          {fy:"FY26", sales:1007.08,disc:366.67, netSales:642.97,cogs:317.43,gp:325.54, empBen:146.83,advMkt:329.87, logistics:53.97,rent:18.99, otherOpex:323.49,totalOpex:739.12,ebitda:-413.58},
        ]

        const rows: {label:string, sub:string, key:keyof typeof yrs[0], bold?:boolean, color:string, divider?:boolean, pctOf?:keyof typeof yrs[0], final?:boolean}[] = [
          {label:"Gross Sales",         sub:"Total invoiced",             key:"sales",      bold:true,  color:C.white},
          {label:"(-) Discounts",       sub:"Trade margins & returns",    key:"disc",       bold:false, color:C.negative},
          {label:"Net Revenue",         sub:"After discounts",            key:"netSales",   bold:true,  color:C.white,   divider:true},
          {label:"(-) COGS",            sub:"Raw mat + packaging + mfg",  key:"cogs",       bold:false, color:C.negative},
          {label:"Gross Profit",        sub:"Net Revenue − COGS",         key:"gp",         bold:true,  color:C.positive,divider:true},
          {label:"Gross Margin %",      sub:"GP / Net Revenue",           key:"gp",         bold:false, color:C.accent,  pctOf:"netSales"},
          {label:"Employee Cost",       sub:"Salaries & wages",           key:"empBen",     bold:false, color:C.neutral},
          {label:"Adv & Marketing",     sub:"Platform ads + brand spends",key:"advMkt",     bold:false, color:C.negative},
          {label:"Logistics",           sub:"Outbound + internal",        key:"logistics",  bold:false, color:C.neutral},
          {label:"Rent",                sub:"Office + warehouse",         key:"rent",       bold:false, color:C.neutral},
          {label:"Other OpEx",          sub:"All other expenses",         key:"otherOpex",  bold:false, color:C.neutral},
          {label:"Total OpEx",          sub:"All operating expenses",     key:"totalOpex",  bold:true,  color:C.negative,divider:true},
          {label:"EBITDA",              sub:"Gross Profit − Total OpEx",  key:"ebitda",     bold:true,  color:C.negative,final:true},
          {label:"EBITDA Margin %",     sub:"EBITDA / Net Revenue",       key:"ebitda",     bold:false, color:C.negative,pctOf:"netSales"},
        ]

        return (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
                <thead>
                  <tr style={{background:C.surfaceAlt}}>
                    <th style={{padding:"10px 14px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,letterSpacing:1,position:"sticky" as const,left:0,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`,minWidth:160,zIndex:3}}>PARTICULARS</th>
                    {yrs.map(y=>(
                      <th key={y.fy} style={{padding:"10px 14px",textAlign:"right" as const,color:y.fy==="FY26"?C.accent:C.dimText,fontWeight:y.fy==="FY26"?800:600,fontSize:y.fy==="FY26"?12:10,minWidth:80,borderLeft:`1px solid ${C.border}`,background:y.fy==="FY26"?C.accentDim:"transparent",whiteSpace:"nowrap" as const}}>
                        {y.fy}{y.fy==="FY26"?" ✦":""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${row.divider||row.final?C.border:C.border+"55"}`,background:row.final?C.negativeDim:row.bold&&!row.pctOf?C.surfaceAlt:"transparent",borderTop:row.divider?`1px solid ${C.accent}22`:"none"}}>
                      <td style={{padding:"8px 14px",position:"sticky" as const,left:0,background:row.final?C.negativeDim:row.bold&&!row.pctOf?C.surfaceAlt:C.bg,borderRight:`1px solid ${C.border}`,zIndex:1}}>
                        <div style={{color:row.final?C.negative:row.bold?C.white:C.neutral,fontWeight:row.bold?700:400,fontSize:row.final?12:11,whiteSpace:"nowrap" as const}}>{row.label}</div>
                        <div style={{color:C.dimText,fontSize:8,marginTop:1}}>{row.sub}</div>
                      </td>
                      {yrs.map((y,j)=>{
                        const raw = y[row.key] as number
                        const val = row.pctOf ? (raw&&y[row.pctOf]?((raw/( y[row.pctOf] as number))*100):null) : raw
                        const isCurr = y.fy==="FY26"
                        const prev = j>0?(yrs[j-1][row.key] as number):null
                        const grew = prev!==null&&Math.abs(raw)>Math.abs(prev)
                        const display = row.pctOf
                          ? (val!==null&&val!==0?`${Math.abs(val as number).toFixed(1)}%`:"—")
                          : (raw===0?"—":raw<0?`(₹${Math.abs(raw).toFixed(1)}L)`:`₹${raw.toFixed(1)}L`)
                        const textColor = isCurr ? row.color : (raw===0?C.dimText+"44":row.color)
                        return (
                          <td key={j} style={{padding:"8px 14px",textAlign:"right" as const,borderLeft:`1px solid ${C.border}`,color:textColor,fontWeight:isCurr?700:row.bold?600:400,background:isCurr?C.accentDim+"55":"transparent",fontSize:isCurr?12:10}}>
                            {display}
                            {!row.pctOf&&j>0&&raw!==0&&prev!==null&&prev!==0&&(
                              <span style={{color:grew?(row.key==="ebitda"?C.negative+"88":C.positive+"88"):(row.key==="ebitda"?C.positive+"88":C.negative+"88"),fontSize:8,marginLeft:3}}>{grew?"↑":"↓"}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:"8px 14px",background:C.surfaceAlt,borderTop:`1px solid ${C.border}`,display:"flex",gap:16,flexWrap:"wrap" as const}}>
              <span style={{color:C.dimText,fontSize:9}}>All figures in ₹ Lakhs · FY21-FY24 from management accounts · FY25-FY26 from Zoho Books</span>
              <span style={{color:C.dimText,fontSize:9}}>↑↓ = year-on-year change vs previous year</span>
            </div>
          </div>
        )
      })()}

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
function CFTab({cfRows,wcRows,bankRows}:{cfRows:string[][];wcRows:string[][];bankRows:string[][]}) {
  const [view,setView]=useState<"wc"|"monthly">("wc")
  const {months,cashIn,cashOut,netFlow}=extractCF(cfRows)
  const totalIn =months.map((_,i)=>Object.values(cashIn).reduce((s,a)=>s+(a[i]||0),0))
  const totalOut=months.map((_,i)=>Object.values(cashOut).reduce((s,a)=>s+(a[i]||0),0))

  // ── BANK DATA PARSER — detailed by transaction_details, grouped by type ──
  const parseBankData = () => {
    if(!bankRows||bankRows.length<2) return null

    const header   = bankRows[0]
    const monthIdx = header.findIndex(h=>h?.toLowerCase()==="month")
    const yearIdx  = header.findIndex(h=>h?.toLowerCase()==="year")
    const accIdx   = header.findIndex(h=>h?.toLowerCase()==="account_name")
    const detIdx   = header.findIndex(h=>h?.toLowerCase()==="transaction_details")
    const txIdx    = header.findIndex(h=>h?.toLowerCase()==="transaction_type")
    const netIdx   = header.findIndex(h=>h?.toLowerCase()==="net_amount")

    if(accIdx===-1||netIdx===-1) return null

    // Collect unique months
    const monthSet = new Set<string>()
    for(let i=1;i<bankRows.length;i++){
      const r=bankRows[i]
      const m=r[monthIdx]?.trim(), y=r[yearIdx]?.trim()
      if(m&&y&&!isNaN(Number(m))&&!isNaN(Number(y))) monthSet.add(`${y}-${m.padStart(2,"0")}`)
    }
    const sortedMonths = Array.from(monthSet).sort()
    const MN=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const mLabels = sortedMonths.map(ym=>{ const [y,m]=ym.split("-"); return `${MN[Number(m)]} ${String(y).slice(2)}` })

    // Group using VENDOR MASTER — canonical names, merged entities
    interface Entry { vals: Record<string,number>; txType: string; canonical: string; category: string; critical: Criticality }
    const entries: Record<string, Entry> = {}

    for(let i=1;i<bankRows.length;i++){
      const r=bankRows[i]
      const m=r[monthIdx]?.trim(), y=r[yearIdx]?.trim()
      if(!m||!y||isNaN(Number(m))||isNaN(Number(y))) continue
      const ym     = `${y}-${m.padStart(2,"0")}`
      const txType = r[txIdx]?.trim()||""
      const acc    = r[accIdx]?.trim()||"Unknown"
      const det    = r[detIdx]?.trim()||acc
      const val    = n(r[netIdx]||"0")
      if(txType==="transfer_fund") continue

      // Bank data columns:
      // account_name      = always "HDFC A/c - 6379" (the bank account)
      // transaction_details = actual entity name (vendor, customer, expense type)
      // So ALWAYS use det (transaction_details) for lookup
      const lookupKey = det || acc
      const info = getVendorInfo(lookupKey)
      // For unmapped customers: use det directly as display name
      const key = (txType==="customer_payment" && info.category!=="PLATFORM IN")
        ? det   // raw customer entity name
        : info.canonical

      const entryCategory = txType==="customer_payment" ? "PLATFORM IN" : (info.category||"OTHER")
      const entryCanonical = (txType==="customer_payment" && info.category!=="PLATFORM IN")
        ? det   // raw customer entity name from transaction_details
        : info.canonical
      if(!entries[key]) entries[key]={vals:{},txType,canonical:entryCanonical,category:entryCategory,critical:info.critical}
      entries[key].vals[ym]=(entries[key].vals[ym]||0)+val
    }

    // Sort months NEW → OLD
    const displayMonths = [...sortedMonths].reverse()
    const displayLabels = displayMonths.map(ym=>{ const [y,m]=ym.split("-"); const MN2=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${MN2[Number(m)]} ${String(y).slice(2)}` })

    interface BR{label:string;canonical:string;category:string;critical:Criticality;vals:number[];type:string;txType:string;isHeader?:boolean;isTotal?:boolean;isSubtotal?:boolean}
    const rows:BR[]=[]

    const custKeys   = Object.keys(entries).filter(k=>entries[k].category==="PLATFORM IN")
    const outKeys    = Object.keys(entries).filter(k=>entries[k].category!=="PLATFORM IN")
    const sumKeys    = (keys:string[],ym:string)=>keys.reduce((s,k)=>s+(entries[k].vals[ym]||0),0)
    const keyVals    = (keys:string[])=>displayMonths.map(ym=>sumKeys(keys,ym))

    // ── CASH OUT ──
    rows.push({label:"TOTAL CASH OUT",canonical:"TOTAL CASH OUT",category:"",critical:"CRITICAL",vals:keyVals(outKeys),type:"OUT",txType:"out",isHeader:true})

    // Group by category in order
    // Include OTHER for unmapped vendors/expenses
    const allCats = Array.from(new Set(outKeys.map(k=>entries[k].category)))
    const outCategories = [...CATEGORY_ORDER.filter(cat=>cat!=="PLATFORM IN"&&allCats.includes(cat)), ...allCats.filter(c=>!CATEGORY_ORDER.includes(c)&&c!=="PLATFORM IN")]
    outCategories.forEach(cat=>{
      const catKeys = outKeys.filter(k=>entries[k].category===cat)
      if(catKeys.length===0) return
      const catVals = keyVals(catKeys)
      if(catVals.every(v=>v===0)) return
      rows.push({label:cat,canonical:cat,category:cat,critical:"CRITICAL",vals:catVals,type:"OUT",txType:"expense",isSubtotal:true})
      
      // Sort by total absolute value descending
      const sorted = catKeys.sort((a,b)=>{
        const sa=Object.values(entries[a].vals).reduce((s,v)=>s+Math.abs(v),0)
        const sb=Object.values(entries[b].vals).reduce((s,v)=>s+Math.abs(v),0)
        return sb-sa
      })
      
      // Show vendor payments first (they are bigger), then direct expenses
      const vendorRows = sorted.filter(k=>entries[k].txType==="vendor_payment")
      const expenseRows = sorted.filter(k=>entries[k].txType!=="vendor_payment")
      
      // Vendor payments with "VENDOR" badge
      vendorRows.forEach(k=>{
        const v=keyVals([k])
        if(v.some(x=>x!==0)) rows.push({label:entries[k].canonical,canonical:entries[k].canonical,category:cat,critical:entries[k].critical,vals:v,type:"VENDOR",txType:"vendor_payment"})
      })
      // Direct expenses
      expenseRows.forEach(k=>{
        const v=keyVals([k])
        if(v.some(x=>x!==0)) rows.push({label:entries[k].canonical,canonical:entries[k].canonical,category:cat,critical:entries[k].critical,vals:v,type:"EXPENSE",txType:entries[k].txType})
      })
    })

    // ── CASH IN — merged by canonical platform name ──
    // Platform display order
    const PLATFORM_ORDER = ["Blinkit","Swiggy","Zepto","BigBasket","BigBasket/NB","Amazon","Amazon (Export)","FirstClub","D2C (Shopify)","Cred (D2C)","11 Seven (B2B)","GoGlocal","LeMarche","INCS","D2C — Direct"]
    rows.push({label:"TOTAL CASH IN",canonical:"TOTAL CASH IN",category:"PLATFORM IN",critical:"CRITICAL",vals:keyVals(custKeys),type:"IN",txType:"customer_payment",isHeader:true})
    // Group all entities by canonical name
    const platformGroups: Record<string,string[]> = {}
    custKeys.forEach(k=>{ const c=entries[k].canonical; if(!platformGroups[c])platformGroups[c]=[]; platformGroups[c].push(k) })
    // Sort by defined order first, then by value
    const sortedPlatforms = Object.keys(platformGroups).sort((a,b)=>{
      const oa=PLATFORM_ORDER.indexOf(a), ob=PLATFORM_ORDER.indexOf(b)
      if(oa>=0&&ob>=0) return oa-ob
      if(oa>=0) return -1
      if(ob>=0) return 1
      return keyVals(platformGroups[b]).reduce((s,v)=>s+v,0)-keyVals(platformGroups[a]).reduce((s,v)=>s+v,0)
    })
    sortedPlatforms.forEach(platform=>{
      const keys=platformGroups[platform]
      const v=keyVals(keys)
      if(v.some(x=>x!==0)) rows.push({label:platform,canonical:platform,category:"PLATFORM IN",critical:"CRITICAL",vals:v,type:"CUSTOMER",txType:"customer_payment"})
    })

    // NET
    const netVals=displayMonths.map(ym=>sumKeys(custKeys,ym)+sumKeys(outKeys,ym))
    rows.push({label:"NET CASH FLOW",canonical:"NET CASH FLOW",category:"NET",critical:"CRITICAL",vals:netVals,type:"NET",txType:"net",isTotal:true})

    return {mLabels:displayLabels,sortedMonths:displayMonths,rows,netVals}
  }

  // ── WC PARSER (fallback) ──
  const parseWC = () => {
    if(!wcRows||wcRows.length<3) return null
    // Find year row (has 2025/2026) and month row (has 1-12)
    let yearRowIdx=-1, monthRowIdx=-1
    for(let i=0;i<Math.min(wcRows.length,8);i++){
      const r=wcRows[i]
      if(r.some(c=>c?.trim()==="2025"||c?.trim()==="2026")) yearRowIdx=i
      const nums=r.filter(c=>{const v=Number(c?.trim());return !isNaN(v)&&v>=1&&v<=12&&c?.trim()!=""})
      if(nums.length>=3) monthRowIdx=i
    }
    const yearRow=yearRowIdx>=0?wcRows[yearRowIdx]:[]
    const monthRow=monthRowIdx>=0?wcRows[monthRowIdx]:[]
    const MN=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const colStart=2
    const mLabels:string[]=[]
    for(let i=colStart;i<Math.max(yearRow.length,monthRow.length,20);i++){
      const m=monthRow[i]?.trim(), y=yearRow[i]?.trim()
      if(m&&y&&!isNaN(Number(m))&&!isNaN(Number(y))&&Number(m)>=1&&Number(m)<=12)
        mLabels.push(`${MN[Number(m)]} ${String(y).slice(2)}`)
    }
    const nCols=mLabels.length||12

    interface WR{type:string;label:string;vals:number[];isHeader?:boolean;isTotal?:boolean;isCashBal?:boolean}
    const rows:WR[]=[]
    let curType=""
    // Cash balance rows at top
    for(let i=0;i<Math.min(5,wcRows.length);i++){
      const r=wcRows[i]
      if(r[0]?.toLowerCase().includes("cash balance")) rows.push({type:"BALANCE",label:r[0].trim(),vals:Array.from({length:nCols},(_,k)=>n(r[colStart+k]||"0")),isCashBal:true})
    }
    // Data rows
    const TYPES=["FIXED COST","VARIABLE","REIMBURSEMENT","VENDOR PAYMENT","customer_payment"]
    for(let i=0;i<wcRows.length;i++){
      const r=wcRows[i]
      if(!r) continue
      const t=r[0]?.trim()||"", lb=r[1]?.trim()||r[0]?.trim()||""
      const vals=Array.from({length:nCols},(_,k)=>n(r[colStart+k]||"0"))
      if(TYPES.includes(t)){
        curType=t==="customer_payment"?"CUSTOMER RECEIPT":t
        rows.push({type:curType,label:curType,vals,isHeader:true})
      } else if(t.toLowerCase().includes("monthly net cash")||t.toLowerCase().includes("net cash outflow")){
        rows.push({type:"NET",label:"NET CASH FLOW",vals,isTotal:true})
      } else if(lb&&curType){
        rows.push({type:curType,label:lb,vals})
      }
    }
    const netRow=rows.find(r=>r.isTotal)
    const cashBal=rows.find(r=>r.isCashBal&&r.label.toLowerCase().includes("cash balance at current"))
    return {mLabels,nCols,rows,netRow,cashBal}
  }

  const bankData=parseBankData()
  const wc=bankData||parseWC()

  return (
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        {view==="wc"&&(bankData||wc)?(
          (()=>{
            const netVals = bankData ? bankData.netVals : (wc as any)?.netRow?.vals || []
            const nCols   = bankData ? bankData.mLabels.length : (wc as any)?.nCols || 0
            const avgNet  = netVals.length ? netVals.reduce((a:number,b:number)=>a+b,0)/netVals.length : 0
            const defMths = netVals.filter((v:number)=>v<0).length
            const bestMth = netVals.length ? Math.max(...netVals) : 0
            return (
              <>
                <KpiCard label="Avg Monthly Net" value={fmt(Math.abs(avgNet),true)} sub={avgNet<0?"avg monthly deficit":"avg monthly surplus"} color={avgNet>=0?C.positive:C.negative}/>
                <KpiCard label="Deficit Months" value={`${defMths} / ${nCols}`} sub="Months with cash burn" color={defMths>6?C.negative:C.accent}/>
                <KpiCard label="Best Month" value={fmt(bestMth,true)} sub="Highest surplus month" color={C.positive}/>
                <KpiCard label="Worst Month" value={fmt(Math.abs(Math.min(...netVals,0)),true)} sub="Highest single month deficit" color={C.negative}/>
              </>
            )
          })()
        ):(
          <>
            <KpiCard label="Avg Monthly Cash In" value={fmt(totalIn.length?totalIn.reduce((a,b)=>a+b,0)/totalIn.length:0,true)} sub="Platform receipts avg" color={C.positive}/>
            <KpiCard label="Avg Monthly Cash Out" value={fmt(totalOut.length?Math.abs(totalOut.reduce((a,b)=>a+b,0)/totalOut.length):0,true)} sub="All expenses avg" color={C.negative}/>
          </>
        )}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:C.surfaceAlt,padding:4,borderRadius:10,width:"fit-content"}}>
        <NavTab label="Working Capital" active={view==="wc"} onClick={()=>setView("wc")}/>
        <NavTab label="Monthly Flow" active={view==="monthly"} onClick={()=>setView("monthly")}/>
      </div>

      {/* ── WORKING CAPITAL VIEW ── */}
      {view==="wc" && (!(bankData||wc) ? (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:40,textAlign:"center" as const,color:C.dimText}}>
          Working capital data loading... Click Refresh if this persists.
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
          {/* Bar chart */}
          {(()=>{
            const nv = bankData ? bankData.netVals : (wc as any)?.netRow?.vals || []
            const ml = bankData ? bankData.mLabels : (wc as any)?.mLabels || []
            return nv.length>0?(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
                <div style={{color:C.white,fontWeight:700,fontSize:13,marginBottom:4}}>Monthly Net Cash Flow</div>
                <div style={{color:C.dimText,fontSize:10,marginBottom:12}}>Cash receipts − Cash outflows (from bank data)</div>
                <BarChart data={nv.map((v:number,i:number)=>({label:ml[i]?.substring(0,3)||`M${i+1}`,value:v}))} height={120}/>
              </div>
            ):null
          })()}
          {/* Full table */}
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,background:C.surfaceAlt}}>
              <span style={{color:C.white,fontWeight:700,fontSize:13}}>Working Capital Requirement</span>
              <span style={{color:C.dimText,fontSize:10,marginLeft:8}}>Live from bank data · {bankData?bankData.mLabels.length:(wc as any)?.nCols||0} months</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:10}}>
                <thead>
                  <tr style={{background:C.surfaceAlt}}>
                    <th style={{padding:"8px 10px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,position:"sticky" as const,left:0,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`,minWidth:55,zIndex:3,letterSpacing:1}}>TYPE</th>
                    <th style={{padding:"8px 12px",textAlign:"left" as const,color:C.dimText,fontWeight:700,fontSize:9,position:"sticky" as const,left:55,background:C.surfaceAlt,borderRight:`1px solid ${C.border}`,minWidth:180,zIndex:3,letterSpacing:1}}>PARTICULARS</th>
                    {(bankData?bankData.mLabels:(wc as any)?.mLabels||[]).map((m:string,i:number)=>(
                      <th key={i} style={{padding:"8px 10px",textAlign:"right" as const,color:C.dimText,fontWeight:600,fontSize:9,minWidth:72,borderLeft:`1px solid ${C.border}`,whiteSpace:"nowrap" as const}}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(bankData?bankData.rows:(wc as any)?.rows?.filter((r:any)=>!r.isCashBal)||[]).map((row:any,i:number)=>{
                    const isPos  = row.type==="CUSTOMER"||row.type==="IN"
                    const isOut  = row.type==="OUT"||row.type==="EXPENSE"||row.type==="VENDOR"||row.type==="CLOSED"
                    const isNet  = row.type==="NET"
                    const isSub  = row.isSubtotal
                    const tc     = isNet?C.accent:isPos?C.positive:C.negative
                    const indent = !row.isHeader&&!row.isTotal&&!isSub ? 16 : 0
                    const bg     = isNet?C.accentDim:row.isHeader?(isPos?C.positiveDim:C.negativeDim):isSub?(isPos?"#16A34A0A":"#DC26260A"):"transparent"
                    const stickyBg = isNet?C.accentDim:row.isHeader?(isPos?C.positiveDim:C.negativeDim):isSub?(isPos?"#16A34A0A":"#DC26260A"):C.bg
                    return (
                      <tr key={i} style={{borderBottom:`1px solid ${row.isHeader||isNet?C.border:C.border+"33"}`,background:bg}}>
                        <td style={{padding:"5px 10px",position:"sticky" as const,left:0,background:stickyBg,borderRight:`1px solid ${C.border}`,zIndex:1,verticalAlign:"middle" as const,width:60}}>
                          {row.isHeader&&<Badge color={tc}>{isPos?"CASH IN":"CASH OUT"}</Badge>}
                          {isNet&&<Badge color={C.accent}>NET</Badge>}
                          {isSub&&<span style={{color:tc,fontSize:8,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase" as const,whiteSpace:"nowrap" as const}}>{row.category}</span>}
                          {!row.isHeader&&!isNet&&!isSub&&row.type==="VENDOR"&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:"#D9770620",color:"#D97706",fontWeight:700}}>VENDOR</span>}
                          {!row.isHeader&&!isNet&&!isSub&&row.type==="EXPENSE"&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:"#64748B20",color:"#64748B",fontWeight:700}}>EXP</span>}
                          {!row.isHeader&&!isNet&&!isSub&&row.type==="CUSTOMER"&&(()=>{
                            const pc=row.label.includes("Blinkit")?PLATFORMS.find(p=>p.name==="Blinkit")?.color:
                              row.label.includes("Swiggy")?PLATFORMS.find(p=>p.name==="Swiggy")?.color:
                              row.label.includes("Zepto")?PLATFORMS.find(p=>p.name==="Zepto")?.color:
                              row.label.includes("BigBasket")?PLATFORMS.find(p=>p.name==="BigBasket")?.color:
                              row.label.includes("Amazon")?PLATFORMS.find(p=>p.name==="Amazon")?.color:
                              row.label.includes("FirstClub")?PLATFORMS.find(p=>p.name==="FirstClub")?.color:
                              C.neutral
                            return pc?<PlatformLogo name={row.label.split(" ")[0]} size={14}/>:null
                          })()}
                        </td>
                        <td style={{padding:"5px 12px",paddingLeft:isSub?16:indent>0?24:12,position:"sticky" as const,left:55,background:stickyBg,borderRight:`1px solid ${C.border}`,zIndex:1,whiteSpace:"nowrap" as const,fontSize:isNet||row.isHeader?11:isSub?10:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            {indent>0&&<span style={{color:C.dimText,fontSize:9}}>└</span>}
                            <span style={{color:isNet?C.accent:row.isHeader?tc:isSub?tc:C.white,fontWeight:isNet||row.isHeader?800:isSub?700:400}}>
                              {row.label}
                            </span>
                            {indent>0&&row.critical&&row.critical!=="CRITICAL"&&(
                              <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:CRITICAL_COLOR[row.critical as Criticality]+"22",color:CRITICAL_COLOR[row.critical as Criticality],fontWeight:700,letterSpacing:0.5}}>
                                {CRITICAL_LABEL[row.critical as Criticality]||row.critical}
                              </span>
                            )}
                          </div>
                        </td>
                        {row.vals.map((v:number,j:number)=>(
                          <td key={j} style={{padding:"5px 10px",textAlign:"right" as const,borderLeft:`1px solid ${C.border}`,
                            color:v===0?C.dimText+"44":isPos?(v>0?C.positive:C.negative):(v<0?C.negative:C.positive),
                            fontWeight:isNet||row.isHeader?800:isSub?700:400,
                            fontSize:isNet||row.isHeader?11:10,
                            background:isNet?(v>=0?C.positiveDim:C.negativeDim):"transparent",
                            opacity:v===0?0.4:1}}>
                            {v===0?"—":v<0?`(${fmt(Math.abs(v),true)})`:fmt(v,true)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* ── MONTHLY FLOW VIEW ── */}
      {view==="monthly" && (
        <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <div style={{color:C.white,fontWeight:700,marginBottom:4}}>Monthly Net Cash Flow</div>
            {netFlow.length>0&&<BarChart data={netFlow.map((v,i)=>({label:(months[i]||"").substring(0,3),value:v}))} height={130}/>}
          </div>
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
                    return (<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px"}}><Badge color={pc}>{p}</Badge></td>
                      {vals.map((v,j)=><td key={j} style={{padding:"8px 10px",color:v>0?C.positive:C.dimText,textAlign:"right" as const}}>{v>0?fmt(v,true):"—"}</td>)}
                      <td style={{padding:"8px 10px",color:C.positive,fontWeight:700,textAlign:"right" as const}}>{fmt(total,true)}</td>
                    </tr>)
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
                    return (<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px",color:C.neutral,fontSize:11}}>{cat}</td>
                      {vals.map((v,j)=><td key={j} style={{padding:"8px 10px",color:v<0?C.negative:C.dimText,textAlign:"right" as const}}>{v<0?fmt(-v,true):"—"}</td>)}
                      <td style={{padding:"8px 10px",color:C.negative,fontWeight:600,textAlign:"right" as const}}>{avg<0?fmt(-avg,true):"—"}</td>
                    </tr>)
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
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11,minWidth:900}}>
                <tbody>
                  <tr style={{background:C.surfaceAlt}}>
                    <td style={{padding:"10px 12px",color:C.accent,fontWeight:800,fontSize:12,minWidth:160}}>NET CASH FLOW</td>
                    {netFlow.map((v,j)=>(<td key={j} style={{padding:"10px 10px",color:v>=0?C.positive:C.negative,fontWeight:800,textAlign:"right" as const,whiteSpace:"nowrap" as const}}>{v>=0?"+":""}{fmt(v,true)}</td>))}
                    <td/>
                  </tr>
                  <tr>
                    <td style={{padding:"8px 12px",color:C.dimText,fontSize:11}}>Status</td>
                    {netFlow.map((v,j)=>(<td key={j} style={{padding:"8px 10px",textAlign:"right" as const}}><Badge color={v>=0?C.positive:v>-1000000?C.accent:C.negative}>{v>=0?"+":v>-1000000?"~":"−"}</Badge></td>))}
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab,setTab]           = useState<"arap"|"pl"|"cf">("arap")
  const [platforms,setPlatforms] = useState<PlatformCalc[]>([])
  const [cfRows,setCfRows]     = useState<string[][]>([])
  const [wcRows,setWcRows]     = useState<string[][]>([])
  const [bankRows,setBankRows] = useState<string[][]>([])
  const [loading,setLoading]   = useState(true)
  const [loadingMsg,setLoadingMsg] = useState("Fetching data...")
  const [error,setError]       = useState("")
  const [lastRefresh,setLastRefresh] = useState<Date|null>(null)
  const [dateFrom,setDateFrom] = useState("")
  const [dateTo,setDateTo]     = useState("")

  const fetchAll = useCallback(async (from?: Date, to?: Date) => {
    setLoading(true); setError("")
    try {
      // Fetch all platform tabs + CF sheet in parallel — no-store to bypass cache
      const nc = {cache:"no-store" as const}
      const cb = `&cachebust=${Date.now()}`
      const platformFetches = PLATFORMS.map(p =>
        fetch(`${SHEET_BASE}?gid=${p.gid}&single=true&output=csv${cb}`, nc)
          .then(r => r.text())
          .then(t => extractPlatformData(parseCSV(t), p.name, p.color, from, to))
      )
      const cfFetch   = fetch(`${CF_URL}${cb}`,   nc).then(r=>r.text()).then(t=>parseCSV(t))
      const wcFetch   = fetch(`${WC_URL}${cb}`,   nc).then(r=>r.text()).then(t=>parseCSV(t))
      const bankFetch = fetch(`${BANK_URL}${cb}`, nc).then(r=>r.text()).then(t=>parseCSV(t))

      setLoadingMsg(`Fetching ${PLATFORMS.length} platform tabs + cash flow...`)
      const [...results] = await Promise.all([...platformFetches, cfFetch, wcFetch, bankFetch])

      const pData = results.slice(0, PLATFORMS.length) as PlatformCalc[]
      const cf    = results[PLATFORMS.length] as string[][]
      const wc    = results[PLATFORMS.length + 1] as string[][]
      const bank  = results[PLATFORMS.length + 2] as string[][]

      setPlatforms(pData)
      setCfRows(cf)
      setWcRows(wc)
      setBankRows(bank)
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
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 20px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.08)"}}>
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
            {tab==="cf"   && <CFTab cfRows={cfRows} wcRows={wcRows} bankRows={bankRows}/>}
          </>
        )}
      </div>

      <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 20px",textAlign:"center" as const,background:C.surfaceAlt}}>
        <span style={{color:C.dimText,fontSize:10,letterSpacing:1}}>LIVE · {PLATFORMS.length} PLATFORM TABS · GOOGLE SHEETS · REFRESH ON LOAD</span>
      </div>
    </div>
  )
}
