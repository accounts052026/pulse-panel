import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Pulse Panel",
  description: "Live AR/AP profitability tracker",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
