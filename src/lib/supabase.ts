import { createClient } from "@supabase/supabase-js"

export type TxType =
  | "sales_invoice"
  | "credit_note"
  | "payment_received"
  | "bill_received"
  | "vendor_credit"
  | "payment_made"

export interface Transaction {
  id?: string
  type: TxType
  date: string
  document_no?: string
  invoice_no?: string
  due_date?: string
  platform: string
  entity?: string
  description?: string
  item_name?: string
  hsn_sac?: string
  qty?: number
  rate?: number
  discount?: number
  debit: number
  credit: number
  amount: number
  igst?: number
  cgst?: number
  sgst?: number
  tds?: number
  status?: string
  created_at?: string
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
