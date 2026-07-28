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

// Fetch a single record's full detail (list endpoints omit line_items).
// Used to discover which account each credit note line posts to, which is
// how a BDPO/discount credit note is distinguished from an undelivered/
// returns one — the list endpoint gives no way to tell them apart.
export async function zohoFetchDetail(path: string): Promise<any> {
  return zohoFetch(path, {})
}

// Module name → Zoho path/listKey, used by the resumable batch sync
// (syncModuleBatch in zoho-store.ts) which fetches a handful of pages per
// call instead of the whole module in one shot — large modules like
// invoices were timing out mid-fetch before any data got written at all.
export const ZOHO_MODULE_CONFIG: Record<string, { path: string; listKey: string; sortColumn?: string }> = {
  // sortColumn only set for the two modules big enough (100+ pages) for
  // pagination drift to plausibly matter — see zohoFetchOnePage below.
  // Left unset for the rest so this fix can't introduce a new failure on
  // a module that doesn't recognize "created_time" as a sort column.
  invoices:         { path: "/invoices",        listKey: "invoices",        sortColumn: "created_time" },
  bills:            { path: "/bills",           listKey: "bills",           sortColumn: "created_time" },
  creditnotes:      { path: "/creditnotes",      listKey: "creditnotes" },
  vendorcredits:    { path: "/vendorcredits",    listKey: "vendor_credits" },
  customerpayments: { path: "/customerpayments", listKey: "customerpayments" },
  vendorpayments:   { path: "/vendorpayments",   listKey: "vendorpayments" },
  journals:         { path: "/journals",         listKey: "journals" },
  expenses:         { path: "/expenses",         listKey: "expenses" },
  bankaccounts:     { path: "/bankaccounts",      listKey: "bankaccounts" },
}

// Fetch exactly one page (used for resumable batch syncing).
//
// sortColumn matters more than it looks here: without an explicit, stable
// sort, Zoho's default list order is effectively "most recently modified
// first." For an actively-trading business, invoices/bills are being
// created or updated continuously — so while a 100+ page sync is in
// progress, newly touched records keep shifting into earlier pages,
// pushing others out of the page window entirely. Those pushed-out
// records never get visited on that pass, and since the next pass starts
// from page 1 again with the same unstable order, some rows can be
// permanently skipped no matter how many times the sync "finishes."
// Sorting by created_time ascending fixes each record's page for the
// duration of a sync — new records land at the end, not in the middle —
// which is exactly the kind of gap that would explain cached receivables
// (1.55 Cr) reading well under Zoho's own total (3.72 Cr) even after a
// completed sync.
export async function zohoFetchOnePage(path: string, listKey: string, page: number, sortColumn?: string): Promise<{ rows: any[]; hasMore: boolean }> {
  const params: Record<string, string> = { page: String(page), per_page: "200" }
  if (sortColumn) { params.sort_column = sortColumn; params.sort_order = "A" }
  const data = await zohoFetch(path, params)
  return { rows: data[listKey] ?? [], hasMore: !!data.page_context?.has_more_page }
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
