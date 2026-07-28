import { NextRequest, NextResponse } from "next/server"
import { getNeon, rowsOf } from "@/lib/neon"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

async function ensureTable() {
  const sql = getNeon()
  await sql`
    CREATE TABLE IF NOT EXISTS entity_mapping (
      entity_name    TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      side           TEXT NOT NULL,
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// GET → { count, rows: [...], map: { "raw entity name": {canonical_name, side} } }
// Visiting this URL directly is the quickest way to see whether mappings
// are actually landing in the table, independent of any UI.
export async function GET() {
  try {
    await ensureTable()
    const sql = getNeon()
    const res = await sql`SELECT entity_name, canonical_name, side, updated_at FROM entity_mapping ORDER BY updated_at DESC`
    const rows = rowsOf<{ entity_name: string; canonical_name: string; side: string; updated_at: string }>(res)
    const map: Record<string, { canonical_name: string; side: string }> = {}
    for (const r of rows) {
      map[r.entity_name] = { canonical_name: r.canonical_name, side: r.side }
    }
    return NextResponse.json({ count: rows.length, rows, map })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST { entity_name, canonical_name, side } → upsert one mapping
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const sql = getNeon()
    const body = await req.json()
    // entity_name is NOT trimmed — it must stay byte-identical to the raw
    // vendor_name/customer_name Zoho returns (which is what /api/zoho/entities
    // uses as the lookup key), otherwise a mapping silently never matches.
    const entity_name    = typeof body.entity_name === "string" ? body.entity_name : ""
    const canonical_name = typeof body.canonical_name === "string" ? body.canonical_name.trim() : ""
    const side            = typeof body.side === "string" ? body.side.trim() : ""
    if (!entity_name || !canonical_name || !side) {
      return NextResponse.json({ error: "entity_name, canonical_name, side are required" }, { status: 400 })
    }
    await sql`
      INSERT INTO entity_mapping (entity_name, canonical_name, side, updated_at)
      VALUES (${entity_name}, ${canonical_name}, ${side}, NOW())
      ON CONFLICT (entity_name) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        side           = EXCLUDED.side,
        updated_at     = NOW()
    `

    // Read the row straight back and confirm it actually persisted. Every
    // previous version of this endpoint returned {ok:true} as soon as the
    // INSERT didn't throw, so any failure to persist looked identical to
    // success from the UI — which is exactly how mappings could report
    // "Saved" and then come back unmapped on reload with nothing to debug.
    const check = rowsOf<{ entity_name: string; canonical_name: string }>(
      await sql`SELECT entity_name, canonical_name FROM entity_mapping WHERE entity_name = ${entity_name}`
    )
    if (check.length === 0) {
      return NextResponse.json(
        { error: `Write did not persist for "${entity_name}" — the INSERT reported success but the row is not readable back.` },
        { status: 500 }
      )
    }
    if (check[0].canonical_name !== canonical_name) {
      return NextResponse.json(
        { error: `Write mismatch for "${entity_name}": stored "${check[0].canonical_name}" but expected "${canonical_name}".` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, saved: check[0] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE ?entity_name=... → remove a mapping (reverts to raw name)
export async function DELETE(req: NextRequest) {
  try {
    await ensureTable()
    const sql = getNeon()
    const entityName = req.nextUrl.searchParams.get("entity_name")
    if (!entityName) return NextResponse.json({ error: "entity_name query param required" }, { status: 400 })
    await sql`DELETE FROM entity_mapping WHERE entity_name = ${entityName}`
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
