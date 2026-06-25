import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const db = getSupabase()
  const { searchParams } = req.nextUrl
  const platform = searchParams.get("platform")
  const type     = searchParams.get("type")
  const from     = searchParams.get("from")
  const to       = searchParams.get("to")

  let q = db.from("pp_transactions").select("*").order("date", { ascending: false })

  if (platform && platform !== "All") q = q.eq("platform", platform)
  if (type)  q = q.eq("type", type)
  if (from)  q = q.gte("date", from)
  if (to)    q = q.lte("date", to)

  const { data, error } = await q.limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const db   = getSupabase()
  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]

  const { data, error } = await db
    .from("pp_transactions")
    .upsert(rows as any[], { onConflict: "id" })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const db       = getSupabase()
  const { ids }  = await req.json()
  const { error } = await db.from("pp_transactions").delete().in("id", ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
