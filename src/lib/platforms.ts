export const PLATFORMS = ["Blinkit", "Swiggy", "Zepto", "Amazon", "Other"] as const
export type Platform = (typeof PLATFORMS)[number]

const ENTITY_MAP: Record<string, Platform> = {
  asvah: "Blinkit",
  moonstone: "Blinkit",
  blinkit: "Blinkit",
  swiggy: "Swiggy",
  bundl: "Swiggy",
  zepto: "Zepto",
  kiranakart: "Zepto",
  amazon: "Amazon",
  cloudtail: "Amazon",
  appario: "Amazon",
}

export function detectPlatform(entity: string): Platform {
  const lower = entity.toLowerCase()
  for (const [key, platform] of Object.entries(ENTITY_MAP)) {
    if (lower.includes(key)) return platform
  }
  return "Other"
}

export const AR_TYPES = ["sales_invoice", "credit_note", "payment_received"] as const
export const AP_TYPES = ["bill_received", "vendor_credit", "payment_made"] as const
