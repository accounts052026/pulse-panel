import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function toExportUrl(url: string): string | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  const sheetId  = match[1]
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid      = gidMatch ? gidMatch[1] : "0"
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 })

  const exportUrl = toExportUrl(url)
  if (!exportUrl) return NextResponse.json({ error: "Not a valid Google Sheets URL" }, { status: 400 })

  try {
    const res = await fetch(exportUrl, { headers: { "User-Agent": "PulsePanel/1.0" } })
    if (!res.ok) return NextResponse.json({ error: `Sheet fetch failed: ${res.status}` }, { status: 502 })
    const csv = await res.text()
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
