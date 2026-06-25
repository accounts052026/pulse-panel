"use client"
import type { View } from "./types"

interface Props {
  view: View
  setView: (v: View) => void
  platform: string
  setPlatform: (p: string) => void
}

const NAV: { group: string; items: { key: View; label: string }[] }[] = [
  {
    group: "OVERVIEW",
    items: [
      { key: "insight", label: "InsightBoard" },
      { key: "monthly", label: "Month-wise" },
    ],
  },
  {
    group: "DATA",
    items: [
      { key: "enter",  label: "Enter Transactions" },
      { key: "ledger", label: "Platform Ledger" },
    ],
  },
]

const PLATFORMS = ["All", "Blinkit", "Swiggy", "Zepto", "Amazon"]

export default function Sidebar({ view, setView, platform, setPlatform }: Props) {
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">Pulse Panel</div>
        <div className="text-xs text-slate-400 mt-0.5">Finance Operations</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5">
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="px-2 mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              {group.group}
            </div>
            {group.items.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  view === item.key
                    ? "bg-violet-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}

        {/* Platform Filter */}
        <div>
          <div className="px-2 mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Platform
          </div>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                platform === p
                  ? "bg-violet-100 text-violet-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </nav>
    </aside>
  )
}
