import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { getNeon } from "@/lib/neon"

export const dynamic = "force-dynamic"

// Called by Vercel cron (nightly) OR manually via POST /api/sync
// Pulls all rows from Supabase → upserts into Neon
// Only syncs rows modified in last N days (default 2) to keep it fast

const CHUNK = 200  // rows per batch into Neon

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const fullSync = body.full === true          // POST { full: true } to sync everything
  const since    = body.since as string | undefined  // ISO date string, optional

  try {
    const sb  = getSupabase()
    const sql = getNeon()

    // ── Fetch from Supabase ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from("pp_transactions") as any).select("*").order("date", { ascending: false })

    if (!fullSync) {
      const cutoff = since || new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)
      q = q.gte("created_at", cutoff)
    }

    const { data, error } = await q.limit(100_000)
    if (error) throw new Error("Supabase fetch: " + error.message)
    if (!data?.length) return NextResponse.json({ ok: true, synced: 0, msg: "Nothing new" })

    // ── Upsert into Neon in chunks ───────────────────────────
    let synced = 0
    for (let i = 0; i < data.length; i += CHUNK) {
      const batch = data.slice(i, i + CHUNK)

      // Build VALUES for upsert
      // We use a temp table approach — insert via individual tagged template calls
      for (const row of batch) {
        await sql`
          INSERT INTO pp_transactions (
            id, type, created_at, synced_at,
            date, due_date, payment_date,
            document_no, invoice_no, order_number, subject, status, payment_terms,
            platform, entity, gstin, gst_treatment, place_of_supply, reverse_charge,
            billing_address, shipping_address, sales_person, branch, account,
            currency, exchange_rate,
            item_name, item_description, item_sku, item_unit, description, hsn_sac,
            qty, rate, discount,
            debit, credit, sub_total, total, amount, adjustment, balance_due,
            igst, cgst, sgst, cess, tds,
            item_tax_name, item_tax_pct, item_tax_amount, total_tax,
            notes, terms, raw_data
          ) VALUES (
            ${row.id}::uuid,
            ${row.type},
            ${row.created_at}::timestamptz,
            NOW(),
            ${row.date}::date,
            ${row.due_date   || null}::date,
            ${row.payment_date || null}::date,
            ${row.document_no   || ''},
            ${row.invoice_no    || ''},
            ${row.order_number  || ''},
            ${row.subject       || ''},
            ${row.status        || 'Open'},
            ${row.payment_terms || ''},
            ${row.platform      || 'Other'},
            ${row.entity        || ''},
            ${row.gstin         || ''},
            ${row.gst_treatment || ''},
            ${row.place_of_supply || ''},
            ${row.reverse_charge  || ''},
            ${row.billing_address  || ''},
            ${row.shipping_address || ''},
            ${row.sales_person  || ''},
            ${row.branch        || ''},
            ${row.account       || ''},
            ${row.currency      || 'INR'},
            ${row.exchange_rate || 1},
            ${row.item_name        || ''},
            ${row.item_description || ''},
            ${row.item_sku         || ''},
            ${row.item_unit        || ''},
            ${row.description      || ''},
            ${row.hsn_sac          || ''},
            ${row.qty      || 0},
            ${row.rate     || 0},
            ${row.discount || 0},
            ${row.debit      || 0},
            ${row.credit     || 0},
            ${row.sub_total  || 0},
            ${row.total      || 0},
            ${row.amount     || 0},
            ${row.adjustment || 0},
            ${row.balance_due|| 0},
            ${row.igst           || 0},
            ${row.cgst           || 0},
            ${row.sgst           || 0},
            ${row.cess           || 0},
            ${row.tds            || 0},
            ${row.item_tax_name  || ''},
            ${row.item_tax_pct   || 0},
            ${row.item_tax_amount|| 0},
            ${row.total_tax      || 0},
            ${row.notes || ''},
            ${row.terms || ''},
            ${JSON.stringify(row.raw_data || {})}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            synced_at        = NOW(),
            status           = EXCLUDED.status,
            balance_due      = EXCLUDED.balance_due,
            amount           = EXCLUDED.amount,
            total            = EXCLUDED.total,
            raw_data         = EXCLUDED.raw_data
        `
        synced++
      }
    }

    return NextResponse.json({
      ok: true,
      synced,
      total_in_supabase: data.length,
      msg: `Synced ${synced} rows from Supabase → Neon`,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET: sync status — row counts in both DBs
export async function GET() {
  try {
    const sb  = getSupabase()
    const sql = getNeon()

    const [sbRes, neonRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb.from("pp_transactions") as any).select("type", { count: "exact", head: false }),
      sql`SELECT type, COUNT(*)::int AS count FROM pp_transactions GROUP BY type ORDER BY type`,
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbCounts: Record<string, number> = {}
    for (const row of sbRes.data || []) {
      sbCounts[row.type] = (sbCounts[row.type] || 0) + 1
    }

    return NextResponse.json({
      supabase: sbCounts,
      neon: Object.fromEntries(neonRes.map((r: { type: string; count: number }) => [r.type, r.count])),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
