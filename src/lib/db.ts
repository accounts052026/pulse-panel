import { neon } from "@neondatabase/serverless"

// Server-side only — uses DATABASE_URL env var set in Vercel
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL env var missing")
  return neon(url)
}
