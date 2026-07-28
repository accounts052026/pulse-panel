// ── Zoho Books API client ──────────────────────────────────────
// Env vars (set in Vercel):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN,
//   ZOHO_ORGANIZATION_ID, ZOHO_REGION (API base, e.g. https://www.zohoapis.in/books/v3)
//   tokenUrl (OAuth token endpoint, e.g. https://accounts.zoho.in/oauth/v2/token)

interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}

let _tokenCache: TokenCache | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 30_000) {
    return _tokenCache.accessToken
  }

  const tokenUrl      = process.env.tokenUrl
  const clientId       = process.env.ZOHO_CLIENT_ID
  const clientSecret   = process.env.ZOHO_CLIENT_SECRET
  const refreshToken   = process.env.ZOHO_REFRESH_TOKEN

  if (!tokenUrl || !clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho OAuth env vars missing (tokenUrl / ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN)")
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    "refresh_token",
  })

  const res = await fetch(`${tokenUrl}?${params.toString()}`, { method: "POST", cache: "no-store" })
  const data = await res.json()

  if (!res.ok || !data.access_token) {
    throw new Error("Zoho token refresh failed: " + JSON.stringify(data))
  }

  _tokenCache = {
    accessToken: data.access_token,
    expiresAt:   Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return _tokenCache.accessToken
}

// ── Generic paginated fetch across a Zoho Books module ─────────
// Zoho caps page size at 200 and offers `page` for pagination.
async function zohoFetch(path: string, extraParams: Record<string, string> = {}): Promise<any> {
  const apiDomain = process.env.ZOHO_REGION // holds the API base URL, e.g. https://www.zohoapis.in/books/v3
  const orgId     = process.env.ZOHO_ORGANIZATION_ID
  if (!apiDomain || !orgId) throw new Error("ZOHO_REGION / ZOHO_ORGANIZATION_ID env vars missing")

  const token = await getAccessToken()
  const params = new URLSearchParams({ organization_id: orgId, ...extraParams })
  const url = `${apiDomain}${path}?${params.toString()}`

  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    cache: "no-store",
  })
  const data = await res.json()
  if (!res.ok || (data.code && data.code !== 0)) {
    throw new Error(`Zoho API error on ${path}: ${data.message || res.statusText}`)
  }
  return data
}

// Fetch every page until Zoho reports no more — each module now syncs
// independently and quickly (see /api/zoho/sync?module=X), so there's no
// need for the old 10-page/2000-row safety cap, which was silently dropping
// real data on any module with more than 2000 records. maxPages is now just
// an outer sanity ceiling (200 pages = 40,000 rows) to prevent a truly
// runaway loop, not a realistic limit for normal org sizes.
async function zohoFetchAll(path: string, listKey: string, extraParams: Record<string, string> = {}, maxPages = 200): Promise<any[]> {
  const out: any[] = []
  let page = 1
  while (page <= maxPages) {
    const data = await zohoFetch(path, { ...extraParams, page: String(page), per_page: "200" })
    const rows = data[listKey] ?? []
    out.push(...rows)
    if (!data.page_context?.has_more_page) break
    page++
    // small pause between pages to stay well clear of Zoho's per-minute rate limit
    await new Promise(r => setTimeout(r, 250))
  }
  return out
}

// ── Module-specific helpers ─────────────────────────────────────

export interface ZohoInvoice {
  invoice_id: string
  invoice_number: string
  customer_name: string
  date: string
  due_date: string
  total: number
  balance: number
  status: string
}

export interface ZohoBill {
  bill_id: string
  bill_number: string
  vendor_name: string
  date: string
  due_date: string
  total: number
  balance: number
  status: string
}

export interface ZohoExpense {
  expense_id: string
  account_name: string
  vendor_name?: string
  date: string
  total: number
}

export interface ZohoBankAccount {
  account_id: string
  account_name: string
  balance: number
}

export interface ZohoCreditNote {
  creditnote_id: string
  customer_name: string
  date: string
  total: number
  status: string
}

export interface ZohoVendorCredit {
  vendor_credit_id: string
  vendor_name: string
  date: string
  total: number
  status: string
}

export interface ZohoCustomerPayment {
  payment_id: string
  customer_name: string
  date: string
  amount: number
  tax_amount_withheld?: number // TDS withheld by customer, if tracked
}

export interface ZohoVendorPayment {
  payment_id: string
  vendor_name: string
  date: string
  amount: number
  tax_amount_withheld?: number // TDS deducted from vendor, if tracked
}

export interface ZohoJournal {
  journal_id: string
  journal_date: string
  reference_number?: string
  total: number
  line_items?: { customer_name?: string; vendor_name?: string; amount: number; debit_or_credit: "debit" | "credit" }[]
}

export async function getInvoices(): Promise<ZohoInvoice[]> {
  return zohoFetchAll("/invoices", "invoices", { sort_column: "date", sort_order: "D" })
}

export async function getBills(): Promise<ZohoBill[]> {
  return zohoFetchAll("/bills", "bills", { sort_column: "date", sort_order: "D" })
}

export async function getCreditNotes(): Promise<ZohoCreditNote[]> {
  return zohoFetchAll("/creditnotes", "creditnotes")
}

export async function getVendorCredits(): Promise<ZohoVendorCredit[]> {
  return zohoFetchAll("/vendorcredits", "vendor_credits")
}

export async function getCustomerPayments(): Promise<ZohoCustomerPayment[]> {
  return zohoFetchAll("/customerpayments", "customerpayments")
}

export async function getVendorPayments(): Promise<ZohoVendorPayment[]> {
  return zohoFetchAll("/vendorpayments", "vendorpayments")
}

export async function getJournals(): Promise<ZohoJournal[]> {
  // Note: the list endpoint returns journal headers without line_items.
  // Full customer/vendor attribution per journal would need a detail call
  // per journal_id (/journals/{id}) — expensive at scale, so journal
  // amounts here are attributed only when Zoho's list response includes
  // reference_number matching a customer/vendor name; otherwise 0.
  return zohoFetchAll("/journals", "journals")
}

export async function getExpenses(): Promise<ZohoExpense[]> {
  return zohoFetchAll("/expenses", "expenses", { sort_column: "date", sort_order: "D" })
}

export async function getBankAccounts(): Promise<ZohoBankAccount[]> {
  const data = await zohoFetch("/bankaccounts", {})
  return data.bankaccounts ?? []
}
