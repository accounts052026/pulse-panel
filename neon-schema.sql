-- ============================================================
-- Pulse Panel — Neon Analytics Schema
-- Run in: Neon Console → SQL Editor
-- Role: Heavy analytics, reconciliation, KPI computation
-- Supabase = operational writes | Neon = analytics reads
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RAW TRANSACTIONS MIRROR (synced from Supabase nightly)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pp_transactions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  synced_at        TIMESTAMPTZ DEFAULT NOW(),

  date             DATE        NOT NULL,
  due_date         DATE,
  payment_date     DATE,
  document_no      TEXT        DEFAULT '',
  invoice_no       TEXT        DEFAULT '',
  order_number     TEXT        DEFAULT '',
  subject          TEXT        DEFAULT '',
  status           TEXT        DEFAULT 'Open',
  payment_terms    TEXT        DEFAULT '',

  platform         TEXT        DEFAULT 'Other',
  entity           TEXT        DEFAULT '',
  gstin            TEXT        DEFAULT '',
  gst_treatment    TEXT        DEFAULT '',
  place_of_supply  TEXT        DEFAULT '',
  reverse_charge   TEXT        DEFAULT '',
  billing_address  TEXT        DEFAULT '',
  shipping_address TEXT        DEFAULT '',
  sales_person     TEXT        DEFAULT '',
  branch           TEXT        DEFAULT '',
  account          TEXT        DEFAULT '',
  currency         TEXT        DEFAULT 'INR',
  exchange_rate    NUMERIC     DEFAULT 1,

  item_name        TEXT        DEFAULT '',
  item_description TEXT        DEFAULT '',
  item_sku         TEXT        DEFAULT '',
  item_unit        TEXT        DEFAULT '',
  description      TEXT        DEFAULT '',
  hsn_sac          TEXT        DEFAULT '',
  qty              NUMERIC     DEFAULT 0,
  rate             NUMERIC     DEFAULT 0,
  discount         NUMERIC     DEFAULT 0,

  debit            NUMERIC     DEFAULT 0,
  credit           NUMERIC     DEFAULT 0,
  sub_total        NUMERIC     DEFAULT 0,
  total            NUMERIC     DEFAULT 0,
  amount           NUMERIC     DEFAULT 0,
  adjustment       NUMERIC     DEFAULT 0,
  balance_due      NUMERIC     DEFAULT 0,

  igst             NUMERIC     DEFAULT 0,
  cgst             NUMERIC     DEFAULT 0,
  sgst             NUMERIC     DEFAULT 0,
  cess             NUMERIC     DEFAULT 0,
  tds              NUMERIC     DEFAULT 0,
  item_tax_name    TEXT        DEFAULT '',
  item_tax_pct     NUMERIC     DEFAULT 0,
  item_tax_amount  NUMERIC     DEFAULT 0,
  total_tax        NUMERIC     DEFAULT 0,

  notes            TEXT        DEFAULT '',
  terms            TEXT        DEFAULT '',
  raw_data         JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_neon_type      ON pp_transactions(type);
CREATE INDEX IF NOT EXISTS idx_neon_date      ON pp_transactions(date);
CREATE INDEX IF NOT EXISTS idx_neon_platform  ON pp_transactions(platform);
CREATE INDEX IF NOT EXISTS idx_neon_month     ON pp_transactions(DATE_TRUNC('month', date));
CREATE INDEX IF NOT EXISTS idx_neon_invoice   ON pp_transactions(invoice_no) WHERE invoice_no != '';
CREATE INDEX IF NOT EXISTS idx_neon_type_date ON pp_transactions(type, date);
CREATE INDEX IF NOT EXISTS idx_neon_plat_date ON pp_transactions(platform, date);


-- ────────────────────────────────────────────────────────────
-- 2. PAYMENT ADVICES (platform settlement data — future)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pp_payment_advices (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  platform            TEXT    NOT NULL,
  settlement_ref      TEXT,
  settlement_date     DATE,
  payment_date        DATE,
  invoice_no          TEXT,            -- JOIN key → pp_transactions.invoice_no
  invoice_date        DATE,
  invoice_amount      NUMERIC DEFAULT 0,
  gross_amount        NUMERIC DEFAULT 0,
  commission          NUMERIC DEFAULT 0,
  commission_pct      NUMERIC DEFAULT 0,
  logistics           NUMERIC DEFAULT 0,
  returns_amount      NUMERIC DEFAULT 0,
  damage_amount       NUMERIC DEFAULT 0,
  penalty             NUMERIC DEFAULT 0,
  other_deductions    NUMERIC DEFAULT 0,
  tds_deducted        NUMERIC DEFAULT 0,
  tcs_deducted        NUMERIC DEFAULT 0,
  gst_on_commission   NUMERIC DEFAULT 0,
  net_payable         NUMERIC DEFAULT 0,
  amount_paid         NUMERIC DEFAULT 0,
  currency            TEXT    DEFAULT 'INR',
  notes               TEXT,
  raw_data            JSONB   DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_adv_platform   ON pp_payment_advices(platform);
CREATE INDEX IF NOT EXISTS idx_adv_invoice    ON pp_payment_advices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_adv_settlement ON pp_payment_advices(settlement_date);


-- ────────────────────────────────────────────────────────────
-- 3. ANALYTICS VIEWS
-- ────────────────────────────────────────────────────────────

-- Monthly platform breakdown
CREATE OR REPLACE VIEW v_monthly_platform AS
SELECT
  TO_CHAR(date, 'YYYY-MM')                                           AS month,
  platform,
  SUM(CASE WHEN type='sales_invoice'    THEN total    ELSE 0 END)    AS invoiced,
  SUM(CASE WHEN type='credit_note'      THEN total    ELSE 0 END)    AS credit_notes,
  SUM(CASE WHEN type='payment_received' THEN amount   ELSE 0 END)    AS cash_in,
  SUM(CASE WHEN type='bill_received'    THEN total    ELSE 0 END)    AS bills,
  SUM(CASE WHEN type='vendor_credit'    THEN total    ELSE 0 END)    AS vendor_credits,
  SUM(CASE WHEN type='payment_made'     THEN amount   ELSE 0 END)    AS cash_out,
  SUM(tds)                                                            AS total_tds,
  SUM(cgst + sgst + igst)                                            AS total_gst,
  SUM(CASE WHEN type='sales_invoice'    THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END)    AS net_ar,
  SUM(CASE WHEN type='bill_received'    THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='vendor_credit'  THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='payment_made'   THEN amount   ELSE 0 END)    AS net_ap,
  SUM(CASE WHEN type='sales_invoice'    THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total    ELSE 0 END)
  - SUM(CASE WHEN type='bill_received'  THEN total    ELSE 0 END)
  + SUM(CASE WHEN type='vendor_credit'  THEN total    ELSE 0 END)    AS gross_margin,
  COUNT(*)                                                            AS row_count
FROM pp_transactions
GROUP BY TO_CHAR(date, 'YYYY-MM'), platform
ORDER BY month DESC, platform;

-- Platform KPI totals
CREATE OR REPLACE VIEW v_platform_kpis AS
SELECT
  platform,
  SUM(CASE WHEN type='sales_invoice'    THEN total  ELSE 0 END)      AS total_invoiced,
  SUM(CASE WHEN type='credit_note'      THEN total  ELSE 0 END)      AS total_credit_notes,
  SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END)      AS total_received,
  SUM(CASE WHEN type='bill_received'    THEN total  ELSE 0 END)      AS total_bills,
  SUM(CASE WHEN type='vendor_credit'    THEN total  ELSE 0 END)      AS total_vendor_credits,
  SUM(CASE WHEN type='payment_made'     THEN amount ELSE 0 END)      AS total_paid,
  SUM(CASE WHEN type='sales_invoice'    THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END)    AS outstanding_ar,
  SUM(CASE WHEN type='bill_received'    THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='vendor_credit'  THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='payment_made'   THEN amount ELSE 0 END)      AS outstanding_ap,
  SUM(CASE WHEN type='sales_invoice'    THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='credit_note'    THEN total  ELSE 0 END)
  - SUM(CASE WHEN type='bill_received'  THEN total  ELSE 0 END)
  + SUM(CASE WHEN type='vendor_credit'  THEN total  ELSE 0 END)      AS gross_margin,
  ROUND(
    (SUM(CASE WHEN type='sales_invoice'   THEN total ELSE 0 END)
     - SUM(CASE WHEN type='credit_note'   THEN total ELSE 0 END)
     - SUM(CASE WHEN type='bill_received' THEN total ELSE 0 END)
     + SUM(CASE WHEN type='vendor_credit' THEN total ELSE 0 END))
    / NULLIF(SUM(CASE WHEN type='sales_invoice' THEN total ELSE 0 END), 0) * 100
  , 2)                                                                AS margin_pct
FROM pp_transactions
GROUP BY platform
ORDER BY total_invoiced DESC;

-- Reconciliation: invoices vs payment advices
CREATE OR REPLACE VIEW v_reconciliation AS
SELECT
  t.invoice_no,
  t.platform,
  t.date                                          AS invoice_date,
  t.entity,
  t.total                                         AS invoiced_amount,
  a.gross_amount,
  a.commission,
  a.returns_amount,
  a.damage_amount,
  a.tds_deducted,
  a.other_deductions,
  a.net_payable,
  a.amount_paid,
  a.settlement_date,
  t.total - COALESCE(a.net_payable, 0)            AS variance,
  CASE
    WHEN a.invoice_no IS NULL                     THEN 'pending'
    WHEN ABS(t.total - a.net_payable) < 1         THEN 'matched'
    WHEN t.total > a.net_payable                  THEN 'short_paid'
    ELSE                                               'over_paid'
  END                                             AS status
FROM pp_transactions t
LEFT JOIN pp_payment_advices a ON t.invoice_no = a.invoice_no
WHERE t.type = 'sales_invoice'
ORDER BY t.date DESC;

-- FY summary (Indian FY: Apr–Mar)
CREATE OR REPLACE VIEW v_fy_summary AS
SELECT
  CASE
    WHEN EXTRACT(MONTH FROM date) >= 4
    THEN CONCAT('FY ', EXTRACT(YEAR FROM date)::TEXT, '-', (EXTRACT(YEAR FROM date)+1)::TEXT)
    ELSE CONCAT('FY ', (EXTRACT(YEAR FROM date)-1)::TEXT, '-', EXTRACT(YEAR FROM date)::TEXT)
  END                                                                 AS fy,
  platform,
  SUM(CASE WHEN type='sales_invoice'    THEN total  ELSE 0 END)      AS invoiced,
  SUM(CASE WHEN type='credit_note'      THEN total  ELSE 0 END)      AS returns,
  SUM(CASE WHEN type='payment_received' THEN amount ELSE 0 END)      AS collected,
  SUM(CASE WHEN type='bill_received'    THEN total  ELSE 0 END)      AS payables,
  SUM(CASE WHEN type='payment_made'     THEN amount ELSE 0 END)      AS paid_out,
  SUM(cgst + sgst + igst)                                             AS total_gst,
  SUM(tds)                                                            AS total_tds
FROM pp_transactions
GROUP BY fy, platform
ORDER BY fy DESC, invoiced DESC;
