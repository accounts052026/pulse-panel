-- ============================================================
-- Pulse Panel — Sales Invoice Import (Simplified)
-- Only 5 columns needed from Zoho invoice export
-- Run in: Supabase → SQL Editor
-- ============================================================

-- Step 1: Create lean staging table
DROP TABLE IF EXISTS stg_sales_invoices CASCADE;
CREATE TABLE stg_sales_invoices (
  "Invoice Date"    TEXT,
  "Invoice Number"  TEXT,
  "Customer Name"   TEXT,
  "PurchaseOrder"   TEXT,
  "Total"           TEXT
);

-- RLS
ALTER TABLE stg_sales_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stg_allow_all ON stg_sales_invoices;
CREATE POLICY stg_allow_all ON stg_sales_invoices FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- Step 2: Import your CSV via Supabase Table Editor
--   → Table Editor → stg_sales_invoices → Import data → Upload CSV
--
-- Before exporting from Zoho: keep only these 5 columns in Excel
--   Invoice Date | Invoice Number | Customer Name | PurchaseOrder | Total
-- ============================================================


-- Step 3: Merge into pp_transactions (run after CSV import)
-- Deletes live invoice rows (post-freeze) then inserts fresh data

DELETE FROM pp_transactions
WHERE type = 'sales_invoice' AND date > '2026-03-31';

INSERT INTO pp_transactions (
  type,
  date,
  document_no,
  invoice_no,
  order_number,
  platform,
  entity,
  total,
  amount,
  debit,
  credit,
  status,
  currency
)
SELECT
  'sales_invoice',
  -- Date: handle dd/mm/yyyy and yyyy-mm-dd
  CASE
    WHEN "Invoice Date" ~ '^\d{2}/\d{2}/\d{4}$'
      THEN TO_DATE("Invoice Date", 'DD/MM/YYYY')
    WHEN "Invoice Date" ~ '^\d{2}-\d{2}-\d{4}$'
      THEN TO_DATE("Invoice Date", 'DD-MM-YYYY')
    WHEN "Invoice Date" ~ '^\d{4}-\d{2}-\d{2}'
      THEN TO_DATE("Invoice Date", 'YYYY-MM-DD')
    ELSE NULL
  END,
  "Invoice Number",
  "Invoice Number",
  "PurchaseOrder",
  -- Auto-detect platform from customer name
  CASE
    WHEN "Customer Name" ILIKE '%blinkit%' OR "Customer Name" ILIKE '%grofers%'           THEN 'Blinkit'
    WHEN "Customer Name" ILIKE '%swiggy%'  OR "Customer Name" ILIKE '%bundl%'             THEN 'Swiggy'
    WHEN "Customer Name" ILIKE '%zepto%'   OR "Customer Name" ILIKE '%kiranakart%'        THEN 'Zepto'
    WHEN "Customer Name" ILIKE '%amazon%'  OR "Customer Name" ILIKE '%cloudtail%'         THEN 'Amazon'
    WHEN "Customer Name" ILIKE '%flipkart%'OR "Customer Name" ILIKE '%ekart%'             THEN 'Flipkart'
    WHEN "Customer Name" ILIKE '%bigbasket%'                                               THEN 'BigBasket'
    WHEN "Customer Name" ILIKE '%dunzo%'                                                   THEN 'Dunzo'
    WHEN "Customer Name" ILIKE '%zepto%'                                                   THEN 'Zepto'
    WHEN "Customer Name" ILIKE '%nykaa%'                                                   THEN 'Nykaa'
    WHEN "Customer Name" ILIKE '%meesho%'                                                  THEN 'Meesho'
    ELSE 'Other'
  END,
  "Customer Name",
  -- Clean numeric Total (strip ₹, commas, spaces)
  COALESCE(
    CAST(REGEXP_REPLACE(COALESCE("Total", '0'), '[^0-9.\-]', '', 'g') AS NUMERIC),
    0
  ),
  COALESCE(
    CAST(REGEXP_REPLACE(COALESCE("Total", '0'), '[^0-9.\-]', '', 'g') AS NUMERIC),
    0
  ),
  0,  -- debit
  0,  -- credit
  'Open',
  'INR'
FROM stg_sales_invoices
WHERE "Invoice Date" IS NOT NULL AND TRIM("Invoice Date") != ''
ON CONFLICT DO NOTHING;


-- Step 4: Verify
SELECT
  platform,
  COUNT(*)        AS invoices,
  SUM(total)      AS total_value,
  MIN(date)       AS earliest,
  MAX(date)       AS latest
FROM pp_transactions
WHERE type = 'sales_invoice'
GROUP BY platform
ORDER BY total_value DESC;
