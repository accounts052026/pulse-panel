import { NextResponse } from "next/server"
import { syncAllFromZoho, getSyncStatus } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // sequential module sync can take a while

// GET — used by Vercel Cron (runs on schedule, see vercel.json) and can
// also be hit directly to trigger a sync. Also doubles as a status check
// when called with ?status=1.
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get("status") === "1") {
    try {
      const status = await getSyncStatus()
      return NextResponse.json({ ok: true, status })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }
  return runSync()
}

// POST — for the manual "Sync now" button in the UI.
export async function POST() {
  return runSync()
}

async function runSync() {
  try {
    const results = await syncAllFromZoho()
    return NextResponse.json({ ok: true, synced_at: new Date().toISOString(), results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
