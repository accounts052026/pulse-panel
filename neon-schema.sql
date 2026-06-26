-- Pulse Panel — Neon Schema
-- Run this in Neon SQL Editor (console.neon.tech → SQL Editor)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pp_transactions (
  -- Identity
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type         TEXT        NOT NULL,                        -- sales_invoice | credit_note | etc.
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  -- Invoice / document header
  date         DATE        NOT NULL,
  due_date     DATE,
  document_no  TEXT        DEFAULT '',
  invoice_no   TEXT        DEFAULT '',
  status       TEXT        DEFAULT 'Open',

  -- Party
  platform     TEXT        DEFAULT 'Other',
  entity       TEXT        DEFAULT '',

  -- Line item
  item_name    TEXT        DEFAULT '',
  description  TEXT        DEFAULT '',
  hsn_sac      TEXT        DEFAULT '',
  qty          NUMERIC     DEFAULT 0,
  rate         NUMERIC     DEFAULT 0,
  discount     NUMERIC     DEFAULT 0,

  -- Amounts
  debit        NUMERIC     DEFAULT 0,
  credit       NUMERIC     DEFAULT 0,
  amount       NUMERIC     DEFAULT 0,

  -- Tax
  igst         NUMERIC     DEFAULT 0,
  cgst         NUMERIC     DEFAULT 0,
  sgst         NUMERIC     DEFAULT 0,
  tds          NUMERIC     DEFAULT 0,

  -- *** ALL original columns from Zoho export — nothing lost ***
  raw_data     JSONB       DEFAULT '{}'
);

-- *** FREEZE TRIGGER — protects FY 2025-26 data (≤ 31-Mar-2026) ***
-- Even if someone calls DELETE directly, these rows cannot be removed.
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

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_pp_type     ON pp_transactions(type);
CREATE INDEX IF NOT EXISTS idx_pp_date     ON pp_transactions(date);
CREATE INDEX IF NOT EXISTS idx_pp_platform ON pp_transactions(platform);
CREATE INDEX IF NOT EXISTS idx_pp_entity   ON pp_transactions(entity);
CREATE INDEX IF NOT EXISTS idx_pp_status   ON pp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pp_raw      ON pp_transactions USING GIN (raw_data);
