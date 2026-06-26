import { createClient } from "@supabase/supabase-js"

export type TxType =
  | "sales_invoice"
  | "credit_note"
  | "payment_received"
  | "bill_received"
  | "vendor_credit"
  | "payment_made"

export interface Transaction {
  id?:               string
  type:              TxType
  created_at?:       string

  // Document header
  date:              string
  due_date?:         string
  payment_date?:     string
  document_no?:      string
  invoice_no?:       string
  order_number?:     string
  subject?:          string
  status?:           string
  payment_terms?:    string

  // Party
  platform:          string
  entity?:           string
  gstin?:            string
  gst_treatment?:    string
  place_of_supply?:  string
  reverse_charge?:   string
  billing_address?:  string
  shipping_address?: string
  sales_person?:     string
  branch?:           string
  account?:          string
  currency?:         string
  exchange_rate?:    number

  // Line item
  item_name?:        string
  item_description?: string
  item_sku?:         string
  item_unit?:        string
  description?:      string
  hsn_sac?:          string
  qty?:              number
  rate?:             number
  discount?:         number

  // Amounts
  debit:             number
  credit:            number
  sub_total?:        number
  total?:            number
  amount:            number
  adjustment?:       number
  balance_due?:      number

  // Tax
  igst?:             number
  cgst?:             number
  sgst?:             number
  cess?:             number
  tds?:              number
  item_tax_name?:    string
  item_tax_pct?:     number
  item_tax_amount?:  number
  total_tax?:        number

  // Notes
  notes?:            string
  terms?:            string

  // Every original column from Zoho — nothing lost
  raw_data?:         Record<string, string>
}

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error("Supabase env vars missing")
    _client = createClient(url, key)
  }
  return _client
}
