import { NextResponse } from "next/server"
import { getNeon, rowsOf } from "@/lib/neon"
import { getEntityMapping, canonical, readEntityMappingRows } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"

// Diagnostic for the entity_mapping read path.
// Open /api/debug/mapping in a browser to see, in one place, exactly what
// each Neon driver call form returns for this table and whether the mapping
// helpers resolve a name. Safe to delete once mapping is confirmed stable.
export async function GET() {
  const out: Record<string, unknown> = {}

  const describe = (label: string, res: unknown) => {
    out[label] = {
      isArray: Array.isArray(res),
      typeofRes: typeof res,
      keys: res && typeof res === "object" && !Array.isArray(res) ? Object.keys(res as object).slice(0, 12) : null,
      rawLength: Array.isArray(res) ? res.length : null,
      rowsOfLength: rowsOf(res).length,
      firstRow: rowsOf(res)[0] ?? null,
    }
  }

  try {
    const sqlT = getNeon()
    const sqlF = getNeon() as unknown as (text: string, params?: unknown[]) => Promise<unknown>
    const QUERY = "SELECT entity_name, canonical_name FROM entity_mapping"

    try {
      describe("taggedTemplateForm", await sqlT`SELECT entity_name, canonical_name FROM entity_mapping`)
    } catch (e) {
      out.taggedTemplateForm = { error: e instanceof Error ? e.message : String(e) }
    }

    try {
      describe("functionCallForm", await sqlF(QUERY))
    } catch (e) {
      out.functionCallForm = { error: e instanceof Error ? e.message : String(e) }
    }

    try {
      const countRes = await sqlF("SELECT COUNT(*)::int AS n FROM entity_mapping")
      out.countViaFunctionForm = rowsOf<{ n: number }>(countRes)[0]?.n ?? null
    } catch (e) {
      out.countViaFunctionForm = { error: e instanceof Error ? e.message : String(e) }
    }

    try {
      const rows = await readEntityMappingRows()
      out.readEntityMappingRows = { length: rows.length, rows: rows.slice(0, 20) }
    } catch (e) {
      out.readEntityMappingRows = { error: e instanceof Error ? e.message : String(e) }
    }

    try {
      const mapping = await getEntityMapping()
      const keys = Object.keys(mapping)
      out.getEntityMapping = {
        keyCount: keys.length,
        sampleKeys: keys.slice(0, 10),
        resolveSamples: {
          "Moonstone Ventures LLP": canonical("Moonstone Ventures LLP", mapping),
          "BLINK COMMERCE PRIVATE LIMITED": canonical("BLINK COMMERCE PRIVATE LIMITED", mapping),
        },
      }
    } catch (e) {
      out.getEntityMapping = { error: e instanceof Error ? e.message : String(e) }
    }

    return NextResponse.json(out)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), partial: out }, { status: 500 })
  }
}
