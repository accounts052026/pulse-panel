-- ============================================================
-- Pulse Panel — Supabase Schema (Full Column Set)
-- Run in: Supabase → SQL Editor → Run All
-- ============================================================

CREATE TABLE IF NOT EXISTS pp_transactions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Document
  date             DATE        NOT NULL,
  due_date         DATE,
  payment_date     DATE,
  document_no      TEXT        DEFAULT '',
  invoice_no       TEXT        DEFAULT '',
  order_number     TEXT        DEFAULT '',
  subject          TEXT        DEFAULT '',
  status           TEXT        DEFAULT 'Open',
  payment_terms    TEXT        DEFAULT '',

  -- Party
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

  -- Line item
  item_name        TEXT        DEFAULT '',
  item_description TEXT        DEFAULT '',
  item_sku         TEXT        DEFAULT '',
  item_unit        TEXT        DEFAULT '',
  description      TEXT        DEFAULT '',
  hsn_sac          TEXT        DEFAULT '',
  qty              NUMERIC     DEFAULT 0,
  rate             NUMERIC     DEFAULT 0,
  discount         NUMERIC     DEFAULT 0,

  -- Amounts
  debit            NUMERIC     DEFAULT 0,
  credit           NUMERIC     DEFAULT 0,
  sub_total        NUMERIC     DEFAULT 0,
  total            NUMERIC     DEFAULT 0,
  amount           NUMERIC     DEFAULT 0,
  adjustment       NUMERIC     DEFAULT 0,
  balance_due      NUMERIC     DEFAULT 0,

  -- Tax
  igst             NUMERIC     DEFAULT 0,
  cgst             NUMERIC     DEFAULT 0,
  sgst             NUMERIC     DEFAULT 0,
  cess             NUMERIC     DEFAULT 0,
  tds              NUMERIC     DEFAULT 0,
  item_tax_name    TEXT        DEFAULT '',
  item_tax_pct     NUMERIC     DEFAULT 0,
  item_tax_amount  NUMERIC     DEFAULT 0,
  total_tax        NUMERIC     DEFAULT 0,

  -- Notes
  notes            TEXT        DEFAULT '',
  terms            TEXT        DEFAULT '',

  -- All original Zoho columns — nothing lost
  raw_data         JSONB       DEFAULT '{}'
);

-- Add missing columns safely
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS order_number     TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS subject          TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS payment_terms    TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS gstin            TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS place_of_supply  TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS gst_treatment    TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS reverse_charge   TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS currency         TEXT    DEFAULT 'INR';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS exchange_rate    NUMERIC DEFAULT 1;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS billing_address  TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS shipping_address TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS sales_person     TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS branch           TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS account          TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_description TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_sku         TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_unit        TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_tax_name    TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_tax_pct     NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_tax_amount  NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS cess             NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS sub_total        NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS total_tax        NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS total            NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS adjustment       NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS balance_due      NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS payment_date     DATE;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS notes            TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS terms            TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS raw_data         JSONB   DEFAULT '{}';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS due_date         DATE;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS invoice_no       TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS item_name        TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS hsn_sac          TEXT    DEFAULT '';
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS qty              NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS rate             NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS discount         NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS igst             NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS cgst             NUMERIC DEFAULT 0;
ALTER TABLE pp_transactions ADD COLUMN IF NOT EXISTS sgst             NUMERIC DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pp_type     ON pp_transactions(type);
CREATE INDEX IF NOT EXISTS idx_pp_date     ON pp_transactions(date);
CREATE INDEX IF NOT EXISTS idx_pp_platform ON pp_transactions(platform);
CREATE INDEX IF NOT EXISTS idx_pp_entity   ON pp_transactions(entity);
CREATE INDEX IF NOT EXISTS idx_pp_status   ON pp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pp_raw      ON pp_transactions USING GIN (raw_data);

-- RLS
ALTER TABLE pp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_allow_all" ON pp_transactions;
CREATE POLICY "pp_allow_all" ON pp_transactions FOR ALL USING (true) WITH CHECK (true);

-- Freeze trigger — FY 2025-26 data (≤ 31-Mar-26) cannot be deleted
CREATE OR REPLACE FUNCTION pp_prevent_frozen_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.date <= '2026-03-31' THEN
    RAISE EXCEPTION 'FROZEN: record dated % is in FY 2025-26 and cannot be deleted', OLD.date;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pp_freeze_historical ON pp_transactions;
CREATE TRIGGER pp_freeze_historical
  BEFORE DELETE ON pp_transactions
  FOR EACH ROW EXECUTE FUNCTION pp_prevent_frozen_delete();
