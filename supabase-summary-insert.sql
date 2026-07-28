-- ============================================================
-- Pulse Panel — Summary Aggregation
-- Compresses all staging data into monthly platform summaries
-- Run AFTER stg_* tables are populated via CSV import
-- Result: ~hundreds of rows instead of tens of thousands
-- ============================================================

-- Clear existing aggregated data (post-freeze only)
DELETE FROM pp_transactions WHERE date > '2026-03-31';

-- ── 1. SALES INVOICES → monthly platform totals ──────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  qty, sub_total, cgst, sgst, igst, cess, tds, total_tax, total,
  amount, debit, credit,
  document_no, status, currency
)
SELECT
  'sales_invoice',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Invoice Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Customer Name"),
  detect_platform("Customer Name"),          -- entity = platform for summaries
  SUM(safe_num("Quantity")),
  SUM(COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal"))),
  SUM(safe_num("CGST")),
  SUM(safe_num("SGST")),
  SUM(safe_num("IGST")),
  SUM(safe_num("CESS")),
  SUM(COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount"))),
  SUM(COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount"))),
  SUM(COALESCE(NULLIF(safe_num("Total"),0), safe_num("Grand Total"))),
  SUM(COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total"), safe_num("Grand Total"))),
  SUM(COALESCE(NULLIF(safe_num("Total"),0), safe_num("Grand Total"))),
  0,
  'Summary',
  'Closed',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_sales_invoices
WHERE safe_date(COALESCE(NULLIF("Invoice Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Invoice Date",''), "Transaction Posting Date"))),
  detect_platform("Customer Name");

-- ── 2. CREDIT NOTES ─────────────────────────────────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  qty, sub_total, cgst, sgst, igst, cess, tds, total_tax, total,
  amount, debit, credit, document_no, currency
)
SELECT
  'credit_note',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Credit Note Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Customer Name"),
  detect_platform("Customer Name"),
  SUM(safe_num("Quantity")),
  SUM(COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal"))),
  SUM(safe_num("CGST")),
  SUM(safe_num("SGST")),
  SUM(safe_num("IGST")),
  SUM(safe_num("CESS")),
  SUM(COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount"))),
  SUM(COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount"))),
  SUM(safe_num("Total")),
  SUM(COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total"))),
  SUM(safe_num("Total")), 0,
  'Summary',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_credit_notes
WHERE safe_date(COALESCE(NULLIF("Credit Note Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Credit Note Date",''), "Transaction Posting Date"))),
  detect_platform("Customer Name");

-- ── 3. PAYMENTS RECEIVED ─────────────────────────────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  tds, amount, debit, credit, document_no, currency
)
SELECT
  'payment_received',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Customer Name"),
  detect_platform("Customer Name"),
  SUM(COALESCE(NULLIF(safe_num("Tax Deducted at Source"),0), safe_num("TDS Amount"))),
  SUM(safe_num("Amount")),
  SUM(safe_num("Amount")), 0,
  'Summary',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_payments_received
WHERE safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date"))),
  detect_platform("Customer Name");

-- ── 4. BILLS RECEIVED ────────────────────────────────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  qty, sub_total, cgst, sgst, igst, cess, tds, total_tax, total,
  amount, debit, credit, document_no, currency
)
SELECT
  'bill_received',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Bill Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Vendor Name"),
  detect_platform("Vendor Name"),
  SUM(safe_num("Quantity")),
  SUM(COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal"))),
  SUM(safe_num("CGST")),
  SUM(safe_num("SGST")),
  SUM(safe_num("IGST")),
  SUM(safe_num("CESS")),
  SUM(COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount"))),
  SUM(COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount"))),
  SUM(safe_num("Total")),
  SUM(COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total"))),
  0, SUM(safe_num("Total")),
  'Summary',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_bills
WHERE safe_date(COALESCE(NULLIF("Bill Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Bill Date",''), "Transaction Posting Date"))),
  detect_platform("Vendor Name");

-- ── 5. VENDOR CREDITS ────────────────────────────────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  qty, sub_total, cgst, sgst, igst, cess, tds, total_tax, total,
  amount, debit, credit, document_no, currency
)
SELECT
  'vendor_credit',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Vendor Credit Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Vendor Name"),
  detect_platform("Vendor Name"),
  SUM(safe_num("Quantity")),
  SUM(COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal"))),
  SUM(safe_num("CGST")),
  SUM(safe_num("SGST")),
  SUM(safe_num("IGST")),
  SUM(safe_num("CESS")),
  SUM(COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount"))),
  SUM(COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount"))),
  SUM(safe_num("Total")),
  SUM(COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total"))),
  0, 0,
  'Summary',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_vendor_credits
WHERE safe_date(COALESCE(NULLIF("Vendor Credit Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Vendor Credit Date",''), "Transaction Posting Date"))),
  detect_platform("Vendor Name");

-- ── 6. PAYMENTS MADE ─────────────────────────────────────────
INSERT INTO pp_transactions (
  type, date, platform, entity,
  tds, amount, debit, credit, document_no, currency
)
SELECT
  'payment_made',
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date")))::DATE,
  detect_platform("Vendor Name"),
  detect_platform("Vendor Name"),
  SUM(COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount"))),
  SUM(safe_num("Amount")),
  0, SUM(safe_num("Amount")),
  'Summary',
  COALESCE(NULLIF(MIN("Currency Code"),''), 'INR')
FROM stg_payments_made
WHERE safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date")) IS NOT NULL
GROUP BY
  DATE_TRUNC('month', safe_date(COALESCE(NULLIF("Payment Date",''), "Transaction Posting Date"))),
  detect_platform("Vendor Name");


-- ============================================================
-- RESULT: Platform × Month comparison view
-- ============================================================
SELECT
  TO_CHAR(date, 'Mon-YY')                                      AS month,
  platform,
  SUM(CASE WHEN type='sales_invoice'    THEN total ELSE 0 END) AS sales,
  SUM(CASE WHEN type='credit_note'      THEN total ELSE 0 END) AS credit_notes,
  SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END)AS cash_in,
  SUM(CASE WHEN type='bill_received'    THEN total ELSE 0 END) AS bills,
  SUM(CASE WHEN type='vendor_credit'    THEN total ELSE 0 END) AS vendor_credits,
  SUM(CASE WHEN type='payment_made'     THEN amount ELSE 0 END)AS cash_out,
  -- Net AR = sales - credit_notes - cash_in
  SUM(CASE WHEN type='sales_invoice'    THEN total ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total ELSE 0 END)
  - SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END) AS net_ar,
  -- Net AP = bills - vendor_credits - cash_out
  SUM(CASE WHEN type='bill_received'    THEN total ELSE 0 END)
  - SUM(CASE WHEN type='vendor_credit'  THEN total ELSE 0 END)
  - SUM(CASE WHEN type='payment_made'   THEN amount ELSE 0 END) AS net_ap,
  -- Gross profit proxy
  SUM(CASE WHEN type='sales_invoice'    THEN total ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total ELSE 0 END)
  - SUM(CASE WHEN type='bill_received'  THEN total ELSE 0 END)
  + SUM(CASE WHEN type='vendor_credit'  THEN total ELSE 0 END) AS gross_margin
FROM pp_transactions
GROUP BY TO_CHAR(date, 'Mon-YY'), date, platform
ORDER BY date, platform;
