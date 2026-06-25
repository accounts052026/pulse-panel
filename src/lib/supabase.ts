import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

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
  platform: string
  entity?: string
  description?: string
  debit: number
  credit: number
  amount: number
  tds?: number
  status?: string
  created_at?: string
}
