-- ============================================================
-- Pulse Panel — Zoho Staging Tables (FULL COLUMN SET)
-- Includes ALL columns Zoho Books exports — standard + custom
-- Run in: Supabase → SQL Editor → Run All
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BILLS (Vendor Bills)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_bills CASCADE;
CREATE TABLE stg_bills (
  -- Core
  "Bill Date"                       TEXT,
  "Transaction Posting Date"        TEXT,
  "Bill#"                           TEXT,
  "Bill ID"                         TEXT,
  "Bill Number"                     TEXT,
  "Bill Status"                     TEXT,
  "Payment Terms"                   TEXT,
  "Payment Terms Label"             TEXT,
  "Due Date"                        TEXT,
  "Submitted Date"                  TEXT,
  "Approved Date"                   TEXT,
  "Submitted By"                    TEXT,
  "Approved By"                     TEXT,
  "Created By"                      TEXT,
  -- Party
  "Vendor Name"                     TEXT,
  "Customer Name"                   TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "GST Treatment"                   TEXT,
  "Place of Supply"                 TEXT,
  "Source of Supply"                TEXT,
  "Destination of Supply"           TEXT,
  "Supply Type"                     TEXT,
  "Reverse Charge"                  TEXT,
  "Reverse Charge Tax Name"         TEXT,
  "Reverse Charge Tax Rate"         TEXT,
  "ITC Eligibility"                 TEXT,
  "Reference Invoice Type"          TEXT,
  -- Order
  "PurchaseOrder"                   TEXT,
  "Purchase Order#"                 TEXT,
  "Purchase Order Number"           TEXT,
  -- Header amounts
  "Subject"                         TEXT,
  "SubTotal"                        TEXT,
  "Sub Total"                       TEXT,
  "Total"                           TEXT,
  "Balance"                         TEXT,
  "Balance Due"                     TEXT,
  "Adjustment"                      TEXT,
  "Adjustment Description"          TEXT,
  "TotalRetentionAmountBCY"         TEXT,
  "TotalRetentionAmountFCY"         TEXT,
  "Entity Discount Percent"         TEXT,
  "Entity Discount Amount"          TEXT,
  "Discount Account"                TEXT,
  "Discount Account Code"           TEXT,
  -- Currency
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  -- Tax header
  "CGST"                            TEXT,
  "SGST"                            TEXT,
  "IGST"                            TEXT,
  "CESS"                            TEXT,
  "CGST Rate %"                     TEXT,
  "SGST Rate %"                     TEXT,
  "IGST Rate %"                     TEXT,
  "CESS Rate %"                     TEXT,
  "CGST(FCY)"                       TEXT,
  "SGST(FCY)"                       TEXT,
  "IGST(FCY)"                       TEXT,
  "CESS(FCY)"                       TEXT,
  "Total Tax"                       TEXT,
  "Tax Amount"                      TEXT,
  "TDS"                             TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Percentage"                  TEXT,
  "TDS Section"                     TEXT,
  "TDS Section Code"                TEXT,
  "TDS TaxID"                       TEXT,
  "TDS Calculation Type"            TEXT,
  "TCS Amount"                      TEXT,
  "TCS Name"                        TEXT,
  "TCS Percentage"                  TEXT,
  "GST TDS ID"                      TEXT,
  "GST TDS Type"                    TEXT,
  "GST TDS Percentage"              TEXT,
  "GST TDS Amount"                  TEXT,
  "Nature Of Collection"            TEXT,
  -- Branch / Location
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Line Item Location Name"         TEXT,
  -- Line item
  "Item Name"                       TEXT,
  "Item Description"                TEXT,
  "Description"                     TEXT,
  "Item Type"                       TEXT,
  "Product ID"                      TEXT,
  "SKU"                             TEXT,
  "Item.CF.Item_Code"               TEXT,
  "HSN/SAC"                         TEXT,
  "Quantity"                        TEXT,
  "Usage unit"                      TEXT,
  "Unit"                            TEXT,
  "Rate"                            TEXT,
  "Item Price"                      TEXT,
  "Is Inclusive Tax"                TEXT,
  "Is Discount Before Tax"          TEXT,
  "Discount Type"                   TEXT,
  "Discount Amount"                 TEXT,
  "Item Discount Account"           TEXT,
  "Item Discount Account Code"      TEXT,
  "Item Total"                      TEXT,
  "Is Billable"                     TEXT,
  "Is Landed Cost"                  TEXT,
  "Account"                         TEXT,
  "Account Code"                    TEXT,
  -- Line item tax
  "Item Tax %"                      TEXT,
  "Item Tax Amount"                 TEXT,
  "Tax ID"                          TEXT,
  "Tax Name"                        TEXT,
  "Tax Percentage"                  TEXT,
  "Tax Type"                        TEXT,
  "Tax Exemption Code"              TEXT,
  "Item TDS Name"                   TEXT,
  "Item TDS Percentage"             TEXT,
  "Item TDS Amount"                 TEXT,
  "Item TDS Section"                TEXT,
  -- Project
  "Project Name"                    TEXT,
  -- Terms & Notes
  "Terms & Conditions"              TEXT,
  "Vendor Notes"                    TEXT,
  -- Custom fields
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ────────────────────────────────────────────────────────────
-- 2. SALES INVOICES
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_sales_invoices CASCADE;
CREATE TABLE stg_sales_invoices (
  -- Core
  "Invoice Date"                    TEXT,
  "Transaction Posting Date"        TEXT,
  "Invoice#"                        TEXT,
  "Invoice ID"                      TEXT,
  "Invoice Status"                  TEXT,
  "Payment Terms"                   TEXT,
  "Payment Terms Label"             TEXT,
  "Due Date"                        TEXT,
  "Submitted Date"                  TEXT,
  "Approved Date"                   TEXT,
  "Submitted By"                    TEXT,
  "Approved By"                     TEXT,
  "Created By"                      TEXT,
  -- Party
  "Customer Name"                   TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "GST Treatment"                   TEXT,
  "Place of Supply"                 TEXT,
  "Source of Supply"                TEXT,
  "Destination of Supply"           TEXT,
  "Supply Type"                     TEXT,
  "Reverse Charge"                  TEXT,
  "Reverse Charge Tax Name"         TEXT,
  "Reverse Charge Tax Rate"         TEXT,
  -- Order
  "PO Number"                       TEXT,
  "Purchase Order#"                 TEXT,
  "Sales Order#"                    TEXT,
  -- Addresses
  "Subject"                         TEXT,
  "Billing Address"                 TEXT,
  "Shipping Address"                TEXT,
  "Sales Person"                    TEXT,
  -- Header amounts
  "Sub Total"                       TEXT,
  "SubTotal"                        TEXT,
  "Total"                           TEXT,
  "Grand Total"                     TEXT,
  "Balance Due"                     TEXT,
  "Balance"                         TEXT,
  "Adjustment"                      TEXT,
  "Adjustment Description"          TEXT,
  "Entity Discount Percent"         TEXT,
  "Entity Discount Amount"          TEXT,
  "Discount Account"                TEXT,
  "Discount Account Code"           TEXT,
  -- Currency
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  -- Tax header
  "CGST"                            TEXT,
  "SGST"                            TEXT,
  "IGST"                            TEXT,
  "CESS"                            TEXT,
  "CGST Rate %"                     TEXT,
  "SGST Rate %"                     TEXT,
  "IGST Rate %"                     TEXT,
  "CESS Rate %"                     TEXT,
  "CGST(FCY)"                       TEXT,
  "SGST(FCY)"                       TEXT,
  "IGST(FCY)"                       TEXT,
  "CESS(FCY)"                       TEXT,
  "Total Tax"                       TEXT,
  "Tax Amount"                      TEXT,
  "TDS"                             TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Percentage"                  TEXT,
  "TDS Section"                     TEXT,
  "TDS Section Code"                TEXT,
  "TDS TaxID"                       TEXT,
  "TDS Calculation Type"            TEXT,
  "TCS Amount"                      TEXT,
  "TCS Name"                        TEXT,
  "TCS Percentage"                  TEXT,
  "GST TDS ID"                      TEXT,
  "GST TDS Type"                    TEXT,
  "GST TDS Percentage"              TEXT,
  "GST TDS Amount"                  TEXT,
  "Nature Of Collection"            TEXT,
  -- Branch / Location
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Line Item Location Name"         TEXT,
  -- Line item
  "Item Name"                       TEXT,
  "Item Description"                TEXT,
  "Description"                     TEXT,
  "Item Type"                       TEXT,
  "Product ID"                      TEXT,
  "SKU"                             TEXT,
  "Item.CF.Item_Code"               TEXT,
  "HSN/SAC"                         TEXT,
  "Quantity"                        TEXT,
  "Usage unit"                      TEXT,
  "Unit"                            TEXT,
  "Rate"                            TEXT,
  "Item Price"                      TEXT,
  "Is Inclusive Tax"                TEXT,
  "Is Discount Before Tax"          TEXT,
  "Discount Type"                   TEXT,
  "Discount Amount"                 TEXT,
  "Item Discount Account"           TEXT,
  "Item Discount Account Code"      TEXT,
  "Item Total"                      TEXT,
  "Is Billable"                     TEXT,
  "Account"                         TEXT,
  "Account Code"                    TEXT,
  -- Line item tax
  "Item Tax %"                      TEXT,
  "Item Tax Amount"                 TEXT,
  "Tax ID"                          TEXT,
  "Tax Name"                        TEXT,
  "Tax Percentage"                  TEXT,
  "Tax Type"                        TEXT,
  "Tax Exemption Code"              TEXT,
  "Item TDS Name"                   TEXT,
  "Item TDS Percentage"             TEXT,
  "Item TDS Amount"                 TEXT,
  "Item TDS Section"                TEXT,
  -- Project
  "Project Name"                    TEXT,
  -- Terms & Notes
  "Customer Notes"                  TEXT,
  "Terms & Conditions"              TEXT,
  -- Custom fields
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ────────────────────────────────────────────────────────────
-- 3. CREDIT NOTES
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_credit_notes CASCADE;
CREATE TABLE stg_credit_notes (
  "Credit Note Date"                TEXT,
  "Transaction Posting Date"        TEXT,
  "Credit Note#"                    TEXT,
  "Credit Note ID"                  TEXT,
  "Credit Note Status"              TEXT,
  "Invoice#"                        TEXT,
  "Submitted Date"                  TEXT,
  "Approved Date"                   TEXT,
  "Submitted By"                    TEXT,
  "Approved By"                     TEXT,
  "Created By"                      TEXT,
  "Customer Name"                   TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "GST Treatment"                   TEXT,
  "Place of Supply"                 TEXT,
  "Source of Supply"                TEXT,
  "Destination of Supply"           TEXT,
  "Supply Type"                     TEXT,
  "Reverse Charge"                  TEXT,
  "Reverse Charge Tax Name"         TEXT,
  "Reverse Charge Tax Rate"         TEXT,
  "Subject"                         TEXT,
  "Billing Address"                 TEXT,
  "Shipping Address"                TEXT,
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  "Sub Total"                       TEXT,
  "SubTotal"                        TEXT,
  "Total"                           TEXT,
  "Balance"                         TEXT,
  "Adjustment"                      TEXT,
  "Adjustment Description"          TEXT,
  "Entity Discount Percent"         TEXT,
  "Entity Discount Amount"          TEXT,
  "Discount Account"                TEXT,
  "Discount Account Code"           TEXT,
  "CGST"                            TEXT,
  "SGST"                            TEXT,
  "IGST"                            TEXT,
  "CESS"                            TEXT,
  "CGST Rate %"                     TEXT,
  "SGST Rate %"                     TEXT,
  "IGST Rate %"                     TEXT,
  "CESS Rate %"                     TEXT,
  "CGST(FCY)"                       TEXT,
  "SGST(FCY)"                       TEXT,
  "IGST(FCY)"                       TEXT,
  "CESS(FCY)"                       TEXT,
  "Total Tax"                       TEXT,
  "Tax Amount"                      TEXT,
  "TDS"                             TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Percentage"                  TEXT,
  "TDS Section"                     TEXT,
  "TDS Section Code"                TEXT,
  "TDS TaxID"                       TEXT,
  "TDS Calculation Type"            TEXT,
  "TCS Amount"                      TEXT,
  "TCS Name"                        TEXT,
  "TCS Percentage"                  TEXT,
  "GST TDS ID"                      TEXT,
  "GST TDS Type"                    TEXT,
  "GST TDS Percentage"              TEXT,
  "GST TDS Amount"                  TEXT,
  "Nature Of Collection"            TEXT,
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Line Item Location Name"         TEXT,
  "Item Name"                       TEXT,
  "Item Description"                TEXT,
  "Description"                     TEXT,
  "Item Type"                       TEXT,
  "Product ID"                      TEXT,
  "SKU"                             TEXT,
  "Item.CF.Item_Code"               TEXT,
  "HSN/SAC"                         TEXT,
  "Quantity"                        TEXT,
  "Usage unit"                      TEXT,
  "Unit"                            TEXT,
  "Rate"                            TEXT,
  "Is Inclusive Tax"                TEXT,
  "Is Discount Before Tax"          TEXT,
  "Discount Type"                   TEXT,
  "Discount Amount"                 TEXT,
  "Item Discount Account"           TEXT,
  "Item Discount Account Code"      TEXT,
  "Item Total"                      TEXT,
  "Account"                         TEXT,
  "Account Code"                    TEXT,
  "Item Tax %"                      TEXT,
  "Item Tax Amount"                 TEXT,
  "Tax ID"                          TEXT,
  "Tax Name"                        TEXT,
  "Tax Percentage"                  TEXT,
  "Tax Type"                        TEXT,
  "Tax Exemption Code"              TEXT,
  "Item TDS Name"                   TEXT,
  "Item TDS Percentage"             TEXT,
  "Item TDS Amount"                 TEXT,
  "Item TDS Section"                TEXT,
  "Project Name"                    TEXT,
  "Notes"                           TEXT,
  "Terms & Conditions"              TEXT,
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ────────────────────────────────────────────────────────────
-- 4. PAYMENTS RECEIVED (Customer Payments)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_payments_received CASCADE;
CREATE TABLE stg_payments_received (
  "Payment Date"                    TEXT,
  "Transaction Posting Date"        TEXT,
  "Payment#"                        TEXT,
  "Payment ID"                      TEXT,
  "Invoice#"                        TEXT,
  "Invoice Date"                    TEXT,
  "Invoice Amount"                  TEXT,
  "Customer Name"                   TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "Payment Mode"                    TEXT,
  "Paid Through"                    TEXT,
  "Reference#"                      TEXT,
  "Bank Charges"                    TEXT,
  "Tax Deducted at Source"          TEXT,
  "TDS %"                           TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Section"                     TEXT,
  "TCS Amount"                      TEXT,
  "Amount"                          TEXT,
  "Unused Credits"                  TEXT,
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Project Name"                    TEXT,
  "Notes"                           TEXT,
  "Created By"                      TEXT,
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ────────────────────────────────────────────────────────────
-- 5. VENDOR CREDITS
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_vendor_credits CASCADE;
CREATE TABLE stg_vendor_credits (
  "Vendor Credit Date"              TEXT,
  "Transaction Posting Date"        TEXT,
  "Vendor Credit#"                  TEXT,
  "Vendor Credit ID"                TEXT,
  "Vendor Credit Status"            TEXT,
  "Bill#"                           TEXT,
  "Submitted Date"                  TEXT,
  "Approved Date"                   TEXT,
  "Submitted By"                    TEXT,
  "Approved By"                     TEXT,
  "Created By"                      TEXT,
  "Vendor Name"                     TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "GST Treatment"                   TEXT,
  "Place of Supply"                 TEXT,
  "Source of Supply"                TEXT,
  "Destination of Supply"           TEXT,
  "Supply Type"                     TEXT,
  "Reverse Charge"                  TEXT,
  "Reverse Charge Tax Name"         TEXT,
  "Reverse Charge Tax Rate"         TEXT,
  "ITC Eligibility"                 TEXT,
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  "Sub Total"                       TEXT,
  "SubTotal"                        TEXT,
  "Total"                           TEXT,
  "Balance"                         TEXT,
  "Adjustment"                      TEXT,
  "Adjustment Description"          TEXT,
  "Entity Discount Percent"         TEXT,
  "Entity Discount Amount"          TEXT,
  "Discount Account"                TEXT,
  "Discount Account Code"           TEXT,
  "CGST"                            TEXT,
  "SGST"                            TEXT,
  "IGST"                            TEXT,
  "CESS"                            TEXT,
  "CGST Rate %"                     TEXT,
  "SGST Rate %"                     TEXT,
  "IGST Rate %"                     TEXT,
  "CESS Rate %"                     TEXT,
  "CGST(FCY)"                       TEXT,
  "SGST(FCY)"                       TEXT,
  "IGST(FCY)"                       TEXT,
  "CESS(FCY)"                       TEXT,
  "Total Tax"                       TEXT,
  "Tax Amount"                      TEXT,
  "TDS"                             TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Percentage"                  TEXT,
  "TDS Section"                     TEXT,
  "TDS Section Code"                TEXT,
  "TDS TaxID"                       TEXT,
  "TDS Calculation Type"            TEXT,
  "TCS Amount"                      TEXT,
  "TCS Name"                        TEXT,
  "TCS Percentage"                  TEXT,
  "GST TDS ID"                      TEXT,
  "GST TDS Type"                    TEXT,
  "GST TDS Percentage"              TEXT,
  "GST TDS Amount"                  TEXT,
  "Nature Of Collection"            TEXT,
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Line Item Location Name"         TEXT,
  "Item Name"                       TEXT,
  "Item Description"                TEXT,
  "Description"                     TEXT,
  "Item Type"                       TEXT,
  "Product ID"                      TEXT,
  "SKU"                             TEXT,
  "Item.CF.Item_Code"               TEXT,
  "HSN/SAC"                         TEXT,
  "Quantity"                        TEXT,
  "Usage unit"                      TEXT,
  "Unit"                            TEXT,
  "Rate"                            TEXT,
  "Is Inclusive Tax"                TEXT,
  "Is Discount Before Tax"          TEXT,
  "Discount Type"                   TEXT,
  "Discount Amount"                 TEXT,
  "Item Discount Account"           TEXT,
  "Item Discount Account Code"      TEXT,
  "Item Total"                      TEXT,
  "Account"                         TEXT,
  "Account Code"                    TEXT,
  "Item Tax %"                      TEXT,
  "Item Tax Amount"                 TEXT,
  "Tax ID"                          TEXT,
  "Tax Name"                        TEXT,
  "Tax Percentage"                  TEXT,
  "Tax Type"                        TEXT,
  "Tax Exemption Code"              TEXT,
  "Item TDS Name"                   TEXT,
  "Item TDS Percentage"             TEXT,
  "Item TDS Amount"                 TEXT,
  "Item TDS Section"                TEXT,
  "Project Name"                    TEXT,
  "Notes"                           TEXT,
  "Terms & Conditions"              TEXT,
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ────────────────────────────────────────────────────────────
-- 6. VENDOR PAYMENTS (Payments Made)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS stg_payments_made CASCADE;
CREATE TABLE stg_payments_made (
  "Payment Date"                    TEXT,
  "Transaction Posting Date"        TEXT,
  "Payment#"                        TEXT,
  "Payment ID"                      TEXT,
  "Bill#"                           TEXT,
  "Bill Date"                       TEXT,
  "Bill Amount"                     TEXT,
  "Vendor Name"                     TEXT,
  "GSTIN/UIN"                       TEXT,
  "GST Identification Number (GSTIN)" TEXT,
  "Payment Mode"                    TEXT,
  "Paid Through"                    TEXT,
  "Reference#"                      TEXT,
  "Bank Charges"                    TEXT,
  "TDS"                             TEXT,
  "TDS Amount"                      TEXT,
  "TDS Name"                        TEXT,
  "TDS Section"                     TEXT,
  "TCS Amount"                      TEXT,
  "Amount"                          TEXT,
  "Currency Code"                   TEXT,
  "Exchange Rate"                   TEXT,
  "Branch"                          TEXT,
  "Branch ID"                       TEXT,
  "Branch Name"                     TEXT,
  "Location Name"                   TEXT,
  "Project Name"                    TEXT,
  "Notes"                           TEXT,
  "Created By"                      TEXT,
  "CF.Month of Expense"             TEXT,
  "CF.GRN No"                       TEXT
);


-- ============================================================
-- RLS — open policies on all staging tables
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stg_bills','stg_sales_invoices','stg_credit_notes',
    'stg_payments_received','stg_vendor_credits','stg_payments_made'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS stg_allow_all ON %I', t);
    EXECUTE format('CREATE POLICY stg_allow_all ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END$$;


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION detect_platform(entity TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  IF entity ILIKE '%blinkit%' OR entity ILIKE '%grofers%'                  THEN RETURN 'Blinkit';
  ELSIF entity ILIKE '%swiggy%'  OR entity ILIKE '%bundl%'                 THEN RETURN 'Swiggy';
  ELSIF entity ILIKE '%zepto%'   OR entity ILIKE '%kiranakart%'            THEN RETURN 'Zepto';
  ELSIF entity ILIKE '%amazon%'  OR entity ILIKE '%cloudtail%'             THEN RETURN 'Amazon';
  ELSIF entity ILIKE '%flipkart%'OR entity ILIKE '%ekart%'                 THEN RETURN 'Flipkart';
  ELSIF entity ILIKE '%bigbasket%'OR entity ILIKE '%supermarket grocery%'  THEN RETURN 'BigBasket';
  ELSIF entity ILIKE '%dunzo%'                                              THEN RETURN 'Dunzo';
  ELSIF entity ILIKE '%instamart%'                                          THEN RETURN 'Instamart';
  ELSIF entity ILIKE '%nykaa%'                                              THEN RETURN 'Nykaa';
  ELSIF entity ILIKE '%meesho%'                                             THEN RETURN 'Meesho';
  ELSE RETURN 'Other';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION safe_num(v TEXT)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE(CAST(REGEXP_REPLACE(COALESCE(v,''), '[^0-9.\-]', '', 'g') AS NUMERIC), 0);
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION safe_date(v TEXT)
RETURNS DATE LANGUAGE plpgsql AS $$
BEGIN
  IF v IS NULL OR TRIM(v) = '' THEN RETURN NULL; END IF;
  BEGIN RETURN TO_DATE(TRIM(v), 'DD/MM/YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN RETURN TO_DATE(TRIM(v), 'DD-MM-YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN RETURN TO_DATE(TRIM(v), 'YYYY-MM-DD'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN RETURN TO_DATE(TRIM(v), 'DD Mon YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN RETURN TO_DATE(TRIM(v), 'MM/DD/YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NULL;
END;
$$;


-- ============================================================
-- MERGE: staging → pp_transactions
-- Run AFTER importing CSVs into the stg_* tables above.
-- ============================================================

-- 1. Bills
DELETE FROM pp_transactions WHERE type='bill_received' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,due_date,document_no,order_number,status,payment_terms,
  platform,entity,gstin,gst_treatment,place_of_supply,reverse_charge,
  currency,exchange_rate,branch,account,
  item_name,item_description,item_sku,item_unit,hsn_sac,
  qty,rate,discount,item_tax_pct,item_tax_amount,
  sub_total,total_tax,adjustment,cgst,sgst,igst,cess,tds,total,balance_due,
  amount,debit,credit,notes,raw_data
)
SELECT
  'bill_received',
  safe_date(COALESCE(NULLIF("Bill Date",''), "Transaction Posting Date")),
  safe_date("Due Date"),
  COALESCE(NULLIF("Bill#",''), "Bill Number", "Bill ID"),
  COALESCE(NULLIF("Purchase Order#",''), "PurchaseOrder", "Purchase Order Number"),
  "Bill Status", "Payment Terms",
  detect_platform("Vendor Name"), "Vendor Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  "GST Treatment", "Place of Supply", "Reverse Charge",
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  COALESCE(NULLIF("Account",''), "Account Code"),
  "Item Name",
  COALESCE(NULLIF("Item Description",''), "Description"),
  "SKU", COALESCE(NULLIF("Unit",''), "Usage unit"), "HSN/SAC",
  safe_num("Quantity"),
  COALESCE(NULLIF(safe_num("Rate"),0), safe_num("Item Price")),
  safe_num("Discount Amount"),
  safe_num("Item Tax %"), safe_num("Item Tax Amount"),
  COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal")),
  COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount")),
  safe_num("Adjustment"),
  safe_num("CGST"), safe_num("SGST"), safe_num("IGST"), safe_num("CESS"),
  COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount")),
  safe_num("Total"),
  COALESCE(NULLIF(safe_num("Balance Due"),0), safe_num("Balance")),
  COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total")),
  0, safe_num("Total"),
  "Vendor Notes",
  row_to_json(stg_bills.*)::jsonb
FROM stg_bills WHERE safe_date(COALESCE(NULLIF("Bill Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Sales Invoices
DELETE FROM pp_transactions WHERE type='sales_invoice' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,due_date,document_no,invoice_no,order_number,subject,status,payment_terms,
  platform,entity,gstin,gst_treatment,place_of_supply,reverse_charge,
  billing_address,shipping_address,sales_person,branch,currency,exchange_rate,
  item_name,item_description,item_sku,item_unit,hsn_sac,
  qty,rate,discount,item_tax_pct,item_tax_amount,
  sub_total,total_tax,adjustment,cgst,sgst,igst,cess,tds,total,balance_due,
  amount,debit,credit,notes,terms,raw_data
)
SELECT
  'sales_invoice',
  safe_date(COALESCE(NULLIF("Invoice Date",''),"Transaction Posting Date")),
  safe_date("Due Date"),
  "Invoice#", "Invoice#",
  COALESCE(NULLIF("PO Number",''), "Purchase Order#", "Sales Order#"),
  "Subject", "Invoice Status", "Payment Terms",
  detect_platform("Customer Name"), "Customer Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  "GST Treatment", "Place of Supply", "Reverse Charge",
  "Billing Address", "Shipping Address", "Sales Person",
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  "Item Name",
  COALESCE(NULLIF("Item Description",''), "Description"),
  "SKU", COALESCE(NULLIF("Unit",''), "Usage unit"), "HSN/SAC",
  safe_num("Quantity"),
  COALESCE(NULLIF(safe_num("Rate"),0), safe_num("Item Price")),
  safe_num("Discount Amount"),
  safe_num("Item Tax %"), safe_num("Item Tax Amount"),
  COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal")),
  COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount")),
  safe_num("Adjustment"),
  safe_num("CGST"), safe_num("SGST"), safe_num("IGST"), safe_num("CESS"),
  COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount")),
  COALESCE(NULLIF(safe_num("Total"),0), safe_num("Grand Total")),
  COALESCE(NULLIF(safe_num("Balance Due"),0), safe_num("Balance")),
  COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total"), safe_num("Grand Total")),
  0, 0,
  "Customer Notes", "Terms & Conditions",
  row_to_json(stg_sales_invoices.*)::jsonb
FROM stg_sales_invoices WHERE safe_date(COALESCE(NULLIF("Invoice Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Credit Notes
DELETE FROM pp_transactions WHERE type='credit_note' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,document_no,invoice_no,status,platform,entity,gstin,
  gst_treatment,place_of_supply,currency,exchange_rate,branch,
  item_name,item_description,item_sku,item_unit,hsn_sac,
  qty,rate,discount,item_tax_pct,item_tax_amount,
  sub_total,total_tax,adjustment,cgst,sgst,igst,cess,tds,total,
  amount,debit,credit,notes,terms,raw_data
)
SELECT
  'credit_note',
  safe_date(COALESCE(NULLIF("Credit Note Date",''),"Transaction Posting Date")),
  "Credit Note#", "Invoice#", "Credit Note Status",
  detect_platform("Customer Name"), "Customer Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  "GST Treatment", "Place of Supply",
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  "Item Name",
  COALESCE(NULLIF("Item Description",''), "Description"),
  "SKU", COALESCE(NULLIF("Unit",''), "Usage unit"), "HSN/SAC",
  safe_num("Quantity"), safe_num("Rate"), safe_num("Discount Amount"),
  safe_num("Item Tax %"), safe_num("Item Tax Amount"),
  COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal")),
  COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount")),
  safe_num("Adjustment"),
  safe_num("CGST"), safe_num("SGST"), safe_num("IGST"), safe_num("CESS"),
  COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount")),
  safe_num("Total"),
  COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total")),
  0, 0,
  "Notes", "Terms & Conditions",
  row_to_json(stg_credit_notes.*)::jsonb
FROM stg_credit_notes WHERE safe_date(COALESCE(NULLIF("Credit Note Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Payments Received
DELETE FROM pp_transactions WHERE type='payment_received' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,document_no,invoice_no,platform,entity,gstin,
  account,tds,amount,currency,exchange_rate,branch,notes,debit,credit,raw_data
)
SELECT
  'payment_received',
  safe_date(COALESCE(NULLIF("Payment Date",''),"Transaction Posting Date")),
  "Payment#", "Invoice#",
  detect_platform("Customer Name"), "Customer Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  COALESCE(NULLIF("Paid Through",''), "Payment Mode"),
  COALESCE(NULLIF(safe_num("Tax Deducted at Source"),0), safe_num("TDS Amount")),
  safe_num("Amount"),
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  "Notes",
  safe_num("Amount"), 0,
  row_to_json(stg_payments_received.*)::jsonb
FROM stg_payments_received WHERE safe_date(COALESCE(NULLIF("Payment Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Vendor Credits
DELETE FROM pp_transactions WHERE type='vendor_credit' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,document_no,invoice_no,status,platform,entity,gstin,
  gst_treatment,place_of_supply,currency,exchange_rate,branch,
  item_name,item_description,item_sku,item_unit,hsn_sac,
  qty,rate,discount,item_tax_pct,item_tax_amount,
  sub_total,total_tax,adjustment,cgst,sgst,igst,cess,tds,total,
  amount,debit,credit,notes,raw_data
)
SELECT
  'vendor_credit',
  safe_date(COALESCE(NULLIF("Vendor Credit Date",''),"Transaction Posting Date")),
  "Vendor Credit#", "Bill#", "Vendor Credit Status",
  detect_platform("Vendor Name"), "Vendor Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  "GST Treatment", "Place of Supply",
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  "Item Name",
  COALESCE(NULLIF("Item Description",''), "Description"),
  "SKU", COALESCE(NULLIF("Unit",''), "Usage unit"), "HSN/SAC",
  safe_num("Quantity"), safe_num("Rate"), safe_num("Discount Amount"),
  safe_num("Item Tax %"), safe_num("Item Tax Amount"),
  COALESCE(NULLIF(safe_num("Sub Total"),0), safe_num("SubTotal")),
  COALESCE(NULLIF(safe_num("Total Tax"),0), safe_num("Tax Amount")),
  safe_num("Adjustment"),
  safe_num("CGST"), safe_num("SGST"), safe_num("IGST"), safe_num("CESS"),
  COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount")),
  safe_num("Total"),
  COALESCE(NULLIF(safe_num("Item Total"),0), safe_num("Total")),
  0, 0,
  "Notes",
  row_to_json(stg_vendor_credits.*)::jsonb
FROM stg_vendor_credits WHERE safe_date(COALESCE(NULLIF("Vendor Credit Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Payments Made
DELETE FROM pp_transactions WHERE type='payment_made' AND date>'2026-03-31';
INSERT INTO pp_transactions (
  type,date,document_no,invoice_no,platform,entity,gstin,
  account,tds,amount,currency,exchange_rate,branch,notes,debit,credit,raw_data
)
SELECT
  'payment_made',
  safe_date(COALESCE(NULLIF("Payment Date",''),"Transaction Posting Date")),
  "Payment#", "Bill#",
  detect_platform("Vendor Name"), "Vendor Name",
  COALESCE(NULLIF("GSTIN/UIN",''), "GST Identification Number (GSTIN)"),
  COALESCE(NULLIF("Paid Through",''), "Payment Mode"),
  COALESCE(NULLIF(safe_num("TDS"),0), safe_num("TDS Amount")),
  safe_num("Amount"),
  COALESCE(NULLIF("Currency Code",''),'INR'), COALESCE(safe_num("Exchange Rate"),1),
  COALESCE(NULLIF("Branch",''), "Branch Name"),
  "Notes",
  0, safe_num("Amount"),
  row_to_json(stg_payments_made.*)::jsonb
FROM stg_payments_made WHERE safe_date(COALESCE(NULLIF("Payment Date",''),"Transaction Posting Date")) IS NOT NULL
ON CONFLICT DO NOTHING;


-- ============================================================
-- Verify — row counts per type
-- ============================================================
SELECT type, COUNT(*) AS rows, MIN(date) AS earliest, MAX(date) AS latest
FROM pp_transactions GROUP BY type ORDER BY type;
