import { NextRequest, NextResponse } from "next/server"
import { syncModule, getSyncStatus, ZOHO_MODULES, type ZohoModule } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/zoho/sync             → cron: syncs ALL modules, one at a time
// GET /api/zoho/sync?module=bills → syncs just that one module (fast, used by the UI's step-by-step sync)
// GET /api/zoho/sync?status=1     → just returns last-sync status, no syncing
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

  if (module) return syncOne(module as ZohoModule)
  return syncAllSequential()
}

export async function POST(req: NextRequest) {
  const module = req.nextUrl.searchParams.get("module")
  if (module) return syncOne(module as ZohoModule)
  return syncAllSequential()
}

async function syncOne(module: ZohoModule) {
  if (!ZOHO_MODULES.includes(module)) {
    return NextResponse.json({ error: `Unknown module "${module}"` }, { status: 400 })
  }
  try {
    const result = await syncModule(module)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, module }, { status: 500 })
  }
}

// Used by the cron job — syncs every module in one request. Each module is
// independently try/caught so one failure (e.g. a transient Zoho hiccup)
// doesn't stop the rest, and a short pause between modules keeps us well
// clear of Zoho's rate limit.
async function syncAllSequential() {
  const results: { module: string; count?: number; error?: string }[] = []
  for (const module of ZOHO_MODULES) {
    try {
      const r = await syncModule(module)
      results.push(r)
    } catch (err: unknown) {
      results.push({ module, error: err instanceof Error ? err.message : String(err) })
    }
    await new Promise(r => setTimeout(r, 400))
  }
  return NextResponse.json({ ok: true, synced_at: new Date().toISOString(), results })
}
