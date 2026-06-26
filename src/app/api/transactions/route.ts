import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Data on or before this date is frozen — never touched by bulk re-imports
const FREEZE_DATE = "2026-03-31"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => getSupabase().from("pp_transactions") as any

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const platform = searchParams.get("platform")
  const type     = searchParams.get("type")
  const from     = searchParams.get("from")
  const to       = searchParams.get("to")

  let q = tbl().select("*").order("date", { ascending: false })
  if (platform && platform !== "All") q = q.eq("platform", platform)
  if (type)  q = q.eq("type", type)
  if (from)  q = q.gte("date", from)
  if (to)    q = q.lte("date", to)

  const { data, error } = await q.limit(10000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const allRows = await req.json()
  const rows    = Array.isArray(allRows) ? allRows : [allRows]

  // Only insert rows after the freeze date
  const live = rows.filter((r: { date?: string }) => !r.date || r.date > FREEZE_DATE)
  if (!live.length) return NextResponse.json([])

  const { data, error } = await tbl().upsert(live, { onConflict: "id" }).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const typeParam = req.nextUrl.searchParams.get("type")
  if (typeParam) {
    // Only delete records AFTER freeze date — FY 2025-26 stays intact
    const { error } = await tbl()
      .delete()
      .eq("type", typeParam)
      .gt("date", FREEZE_DATE)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  const { ids } = await req.json()
  const { error } = await tbl().delete().in("id", ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
