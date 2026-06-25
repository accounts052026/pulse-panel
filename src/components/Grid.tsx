"use client"
import { useRef, useState, useCallback } from "react"

export interface ColDef {
  key: string
  label: string
  width?: number
  type?: "text" | "number" | "date" | "select"
  options?: string[]
}

interface Props {
  cols: ColDef[]
  rows: Record<string, string>[]
  onChange: (rows: Record<string, string>[]) => void
  headerClass?: string
}

const EMPTY = (cols: ColDef[]) =>
  Object.fromEntries(cols.map((c) => [c.key, ""])) as Record<string, string>

export default function Grid({ cols, rows, onChange, headerClass = "grid-header" }: Props) {
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null)
  const [editing, setEditing] = useState(false)

  const displayRows = [...rows]
  while (displayRows.length < 30) displayRows.push(EMPTY(cols))

  const update = (ri: number, key: string, value: string) => {
    const next = [...displayRows]
    next[ri] = { ...next[ri], [key]: value }
    let last = next.length - 1
    while (last > 0 && cols.every((c) => !next[last][c.key])) last--
    onChange(next.slice(0, last + 1))
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent, startRow: number, startCol: number) => {
      e.preventDefault()
      const text = e.clipboardData.getData("text/plain")
      const pastedRows = text.trim().split("\n").map((r) => r.split("\t"))

      const firstRow = pastedRows[0].map((c) => c.toLowerCase().trim())
      const hasHeader = firstRow.some((c) =>
        ["date", "invoice", "document", "amount", "dr", "cr", "debit", "credit", "status"].includes(c)
      )
      const dataRows = hasHeader ? pastedRows.slice(1) : pastedRows

      let colMap: number[] = cols.map((_, i) => startCol + i)
      if (hasHeader) {
        colMap = cols.map((col) => {
          return firstRow.findIndex((h) =>
            h.includes(col.key.toLowerCase()) ||
            h.includes(col.label.toLowerCase()) ||
            (col.key === "debit"  && (h === "dr" || h === "debit")) ||
            (col.key === "credit" && (h === "cr" || h === "credit")) ||
            (col.key === "amount" && (h === "amount" || h.includes("net")))
          )
        })
      }

      const next = [...displayRows]
      dataRows.forEach((pr, ri) => {
        const rowIdx = startRow + ri
        if (rowIdx >= 1000) return
        const row = { ...(next[rowIdx] ?? EMPTY(cols)) }
        cols.forEach((col, ci) => {
          const srcIdx = colMap[ci] ?? -1
          if (srcIdx >= 0 && pr[srcIdx] !== undefined) row[col.key] = pr[srcIdx].trim()
        })
        next[rowIdx] = row
      })

      let last = next.length - 1
      while (last > 0 && cols.every((c) => !next[last][c.key])) last--
      onChange(next.slice(0, last + 1))
    },
    [cols, displayRows, onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent, ri: number, ci: number) => {
    if (e.key === "Tab") {
      e.preventDefault()
      setSel({ r: ri, c: e.shiftKey ? Math.max(0, ci - 1) : Math.min(cols.length - 1, ci + 1) })
      setEditing(false)
    }
    if (e.key === "Enter")  { e.preventDefault(); setSel({ r: ri + 1, c: ci }); setEditing(false) }
    if (e.key === "Escape") setEditing(false)
    if ((e.key === "Delete" || e.key === "Backspace") && !editing) { update(ri, cols[ci].key, ""); e.preventDefault() }
    if (!editing && e.key.length === 1) setEditing(true)
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key) && !editing) {
      e.preventDefault()
      const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
      const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
      setSel({ r: Math.max(0, ri + dr), c: Math.max(0, Math.min(cols.length - 1, ci + dc)) })
    }
  }

  return (
    <div className="overflow-auto border border-slate-200 rounded">
      <table className="border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th className={`grid-cell ${headerClass}`} style={{ width: 36 }}>#</th>
            {cols.map((col) => (
              <th key={col.key} className={`grid-cell ${headerClass}`} style={{ width: col.width ?? 130 }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="grid-cell text-center text-slate-400 text-xs select-none" style={{ width: 36 }}>
                {ri + 1}
              </td>
              {cols.map((col, ci) => {
                const isSelected = sel?.r === ri && sel?.c === ci
                const isEditing  = isSelected && editing
                return (
                  <td
                    key={col.key}
                    className={`grid-cell cursor-text ${isSelected ? "ring-2 ring-inset ring-indigo-400" : ""}`}
                    style={{ width: col.width ?? 130 }}
                    tabIndex={0}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onFocus={() => { setSel({ r: ri, c: ci }); setEditing(false) }}
                    onClick={() => setSel({ r: ri, c: ci })}
                    onDoubleClick={() => { setSel({ r: ri, c: ci }); setEditing(true) }}
                    onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                    onPaste={(e) => handlePaste(e, ri, ci)}
                    onBlur={(e) => {
                      if (isEditing) { update(ri, col.key, e.currentTarget.textContent ?? ""); setEditing(false) }
                    }}
                  >
                    {row[col.key]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
