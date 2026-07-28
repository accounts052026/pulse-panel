import { NextRequest, NextResponse } from "next/server"
import { getNeon } from "@/lib/neon"

export const dynamic = "force-dynamic"

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

// GET → { "raw entity name": { canonical_name, side } }
export async function GET() {
  try {
    await ensureTable()
    const sql = getNeon()
    const rows = await sql`SELECT entity_name, canonical_name, side FROM entity_mapping`
    const map: Record<string, { canonical_name: string; side: string }> = {}
    for (const r of rows as unknown as { entity_name: string; canonical_name: string; side: string }[]) {
      map[r.entity_name] = { canonical_name: r.canonical_name, side: r.side }
    }
    return NextResponse.json(map)
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
    return NextResponse.json({ ok: true })
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
