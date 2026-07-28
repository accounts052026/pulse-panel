import { NextRequest, NextResponse } from "next/server"
import { syncModuleBatch, getSyncStatus, ZOHO_MODULES, type ZohoModule } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// GET /api/zoho/sync                → cron: runs one batch (few pages) per module, sequentially
// GET /api/zoho/sync?module=bills   → runs one batch for just that module — call repeatedly
//                                      (see the UI's "Sync Zoho Now" loop) until `done: true`
// GET /api/zoho/sync?status=1       → just returns last-sync status, no syncing
export async function GET(req: NextRequest) {
  const module = req.nextUrl.searchParams.get("module")
  const statusOnly = req.nextUrl.searchParams.get("status") === "1"

  if (statusOnly) {
    try {
      return NextResponse.json({ ok: true, status: await getSyncStatus() })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (module) return syncOneBatch(module as ZohoModule)
  return syncAllOneBatchEach()
}

export async function POST(req: NextRequest) {
  const module = req.nextUrl.searchParams.get("module")
  if (module) return syncOneBatch(module as ZohoModule)
  return syncAllOneBatchEach()
}

async function syncOneBatch(module: ZohoModule) {
  if (!ZOHO_MODULES.includes(module)) {
    return NextResponse.json({ error: `Unknown module "${module}"` }, { status: 400 })
  }
  try {
    const result = await syncModuleBatch(module)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, module }, { status: 500 })
  }
}

// Used by the cron job — runs ONE batch (a few pages) per module per call.
// A module with a lot of data won't fully finish in a single cron run, but
// it makes guaranteed forward progress every time (via the resumable page
// cursor in zoho_sync_cursor) rather than either "all or nothing" timing
// out, or racing to cram everything into one request.
async function syncAllOneBatchEach() {
  const results: { module: string; fetchedThisCall?: number; totalRows?: number; done?: boolean; error?: string }[] = []
  for (const module of ZOHO_MODULES) {
    try {
      const r = await syncModuleBatch(module)
      results.push(r)
    } catch (err: unknown) {
      results.push({ module, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return NextResponse.json({ ok: true, synced_at: new Date().toISOString(), results })
}
