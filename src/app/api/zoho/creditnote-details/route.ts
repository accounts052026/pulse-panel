import { NextRequest, NextResponse } from "next/server"
import { syncCreditNoteDetailsBatch } from "@/lib/zoho-store"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 60

// Enriches credit notes with their line-item accounts, which is what lets
// BDPO (post-sales discount) be told apart from returns/undelivered.
// Bounded per call — the UI calls it repeatedly until `remaining` hits 0.
export async function POST(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit")) || 40
    const result = await syncCreditNoteDetailsBatch(limit)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
