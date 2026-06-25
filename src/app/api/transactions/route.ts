import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

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

  const { data, error } = await q.limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]
  const { data, error } = await tbl().upsert(rows, { onConflict: "id" }).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json()
  const { error } = await tbl().delete().in("id", ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
