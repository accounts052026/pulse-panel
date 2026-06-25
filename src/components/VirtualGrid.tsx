"use client"
/**
 * VirtualGrid — handles unlimited rows × columns
 * Only renders visible rows in the DOM (windowing).
 * Supports paste from any spreadsheet/Zoho export.
 */
import { useRef, useState, useCallback, useEffect, useMemo } from "react"

export interface VGColumn {
  key: string
  label: string
  width?: number
}

interface Props {
  cols: VGColumn[]
  rows: string[][]           // 2D array — rows[r][c]
  onRowsChange: (rows: string[][]) => void
  headerClass?: string
  rowHeight?: number
  visibleRows?: number       // how many rows to render at once
}

const ROW_H     = 26
const VISIBLE   = 40        // render window size
const MIN_ROWS  = 50        // minimum blank rows shown

export default function VirtualGrid({
  cols,
  rows,
  onRowsChange,
  headerClass = "bg-slate-100 text-slate-600",
  rowHeight = ROW_H,
  visibleRows = VISIBLE,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [scrollTop,   setScrollTop]   = useState(0)
  const [sel,         setSel]         = useState<[number, number] | null>(null)
  const [editVal,     setEditVal]     = useState("")
  const [editing,     setEditing]     = useState(false)
  const inputRef      = useRef<HTMLInputElement>(null)

  // Pad rows to minimum
  const totalRows = Math.max(rows.length + 10, MIN_ROWS)

  const getCell = (r: number, c: number) => rows[r]?.[c] ?? ""
  const setCell = useCallback((r: number, c: number, val: string) => {
    const next = rows.map(row => [...row])
    while (next.length <= r) next.push([])
    while (next[r].length <= c) next[r].push("")
    next[r][c] = val
    // trim trailing empty rows
    let last = next.length - 1
    while (last > 0 && next[last].every(v => !v)) last--
    onRowsChange(next.slice(0, last + 1))
  }, [rows, onRowsChange])

  // Virtual scroll window
  const startRow  = Math.max(0, Math.floor(scrollTop / rowHeight) - 5)
  const endRow    = Math.min(totalRows, startRow + visibleRows + 10)
  const visibleRowIndices = useMemo(
    () => Array.from({ length: endRow - startRow }, (_, i) => startRow + i),
    [startRow, endRow]
  )

  // Paste handler
  const handlePaste = useCallback((e: React.ClipboardEvent, startR: number, startC: number) => {
    e.preventDefault()
    const text  = e.clipboardData.getData("text/plain")
    const lines = text.trim().split(/\r?\n/)

    // Detect if first row is header
    const firstCells = lines[0].split("\t").map(c => c.toLowerCase().trim())
    const isHeader   = firstCells.some(c =>
      ["date","invoice","document","amount","dr","cr","debit","credit","status","entity","party"].includes(c)
    )

    const dataLines = isHeader ? lines.slice(1) : lines

    // Smart column mapping when header present
    let colMap: number[] | null = null
    if (isHeader) {
      colMap = cols.map(col => {
        const key = col.key.toLowerCase()
        return firstCells.findIndex(h =>
          h === key ||
          h.includes(key) ||
          (key === "debit"  && (h === "dr" || h.includes("debit"))) ||
          (key === "credit" && (h === "cr" || h.includes("credit"))) ||
          (key === "amount" && (h === "amount" || h.includes("net"))) ||
          (key === "entity" && (h.includes("party") || h.includes("vendor") || h.includes("customer")))
        )
      })
    }

    const next = rows.map(row => [...row])
    dataLines.forEach((line, ri) => {
      const cells = line.split("\t")
      const rowIdx = startR + ri
      while (next.length <= rowIdx) next.push([])

      if (colMap) {
        // Map to known columns
        colMap.forEach((srcIdx, ci) => {
          const destC = startC + ci
          while (next[rowIdx].length <= destC) next[rowIdx].push("")
          if (srcIdx >= 0 && cells[srcIdx] !== undefined) {
            next[rowIdx][destC] = cells[srcIdx].trim()
          }
        })
      } else {
        // Raw paste — fill as-is
        cells.forEach((cell, ci) => {
          const destC = startC + ci
          while (next[rowIdx].length <= destC) next[rowIdx].push("")
          next[rowIdx][destC] = cell.trim()
        })
      }
    })

    let last = next.length - 1
    while (last > 0 && next[last].every(v => !v)) last--
    onRowsChange(next.slice(0, last + 1))
    setSel([startR + dataLines.length - 1, startC])
  }, [rows, cols, onRowsChange])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, r: number, c: number) => {
    if (editing) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        setCell(r, c, editVal)
        setEditing(false)
        setSel(e.key === "Tab"
          ? [r, Math.min(cols.length - 1, c + (e.shiftKey ? -1 : 1))]
          : [r + 1, c]
        )
      }
      if (e.key === "Escape") { setEditing(false); setSel([r, c]) }
      return
    }

    const moves: Record<string, [number, number]> = {
      ArrowUp:    [-1,  0],
      ArrowDown:  [ 1,  0],
      ArrowLeft:  [ 0, -1],
      ArrowRight: [ 0,  1],
    }

    if (moves[e.key]) {
      e.preventDefault()
      const [dr, dc] = moves[e.key]
      setSel([Math.max(0, r + dr), Math.max(0, Math.min(cols.length - 1, c + dc))])
    } else if (e.key === "Tab") {
      e.preventDefault()
      setSel([r, Math.max(0, Math.min(cols.length - 1, c + (e.shiftKey ? -1 : 1)))])
    } else if (e.key === "Enter") {
      e.preventDefault(); setSel([r + 1, c])
    } else if (e.key === "Delete" || e.key === "Backspace") {
      setCell(r, c, "")
    } else if (e.key === "F2" || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
      setEditVal(e.key === "F2" ? getCell(r, c) : e.key)
      setEditing(true)
    }
  }, [editing, editVal, cols.length, setCell, getCell])

  // Focus input when editing starts
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing, sel])

  // Scroll selected row into view
  useEffect(() => {
    if (!sel || !containerRef.current) return
    const [r] = sel
    const top    = r * rowHeight
    const bottom = top + rowHeight
    const cTop   = containerRef.current.scrollTop
    const cBot   = cTop + containerRef.current.clientHeight
    if (top < cTop)    containerRef.current.scrollTop = top
    if (bottom > cBot) containerRef.current.scrollTop = bottom - containerRef.current.clientHeight
  }, [sel, rowHeight])

  const dataRowCount = rows.length

  return (
    <div className="border border-slate-200 rounded overflow-hidden flex flex-col">
      {/* Stats bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1 text-xs text-slate-500 flex gap-4">
        <span>{dataRowCount} rows × {cols.length} cols</span>
        {sel && <span>Cell: R{sel[0]+1} C{sel[1]+1}</span>}
        <span className="text-slate-400">Ctrl+V to paste from Zoho/Excel</span>
      </div>

      {/* Frozen header */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: cols.reduce((s, c) => s + (c.width ?? 120), 40) }}>
          <div className={`flex ${headerClass} border-b border-slate-200 sticky top-0 z-20`}>
            <div className="w-10 shrink-0 px-2 py-1.5 text-[11px] font-semibold border-r border-slate-200 text-center">#</div>
            {cols.map((col) => (
              <div
                key={col.key}
                style={{ width: col.width ?? 120, minWidth: col.width ?? 120 }}
                className="px-2 py-1.5 text-[11px] font-semibold border-r border-slate-200 truncate"
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Virtual scroll body */}
          <div
            ref={containerRef}
            className="overflow-y-auto"
            style={{ height: Math.min(visibleRows, totalRows) * rowHeight + 2 }}
            onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            {/* Top spacer */}
            <div style={{ height: startRow * rowHeight }} />

            {visibleRowIndices.map(r => (
              <div
                key={r}
                className={`flex border-b border-slate-100 ${r % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                style={{ height: rowHeight }}
              >
                {/* Row number */}
                <div className="w-10 shrink-0 flex items-center justify-center text-[10px] text-slate-400 border-r border-slate-200 select-none">
                  {r + 1}
                </div>

                {cols.map((col, c) => {
                  const isSelected = sel?.[0] === r && sel?.[1] === c
                  const val = getCell(r, c)

                  return (
                    <div
                      key={col.key}
                      style={{ width: col.width ?? 120, minWidth: col.width ?? 120 }}
                      className={`relative border-r border-slate-100 flex items-center overflow-hidden ${
                        isSelected ? "ring-2 ring-inset ring-violet-500 z-10" : ""
                      }`}
                      tabIndex={0}
                      onFocus={() => { setSel([r, c]); setEditing(false) }}
                      onClick={() => setSel([r, c])}
                      onDoubleClick={() => { setSel([r, c]); setEditVal(getCell(r, c)); setEditing(true) }}
                      onKeyDown={e => handleKeyDown(e, r, c)}
                      onPaste={e => handlePaste(e, r, c)}
                    >
                      {isSelected && editing ? (
                        <input
                          ref={inputRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => { setCell(r, c, editVal); setEditing(false) }}
                          onKeyDown={e => handleKeyDown(e, r, c)}
                          className="absolute inset-0 w-full h-full px-2 text-xs bg-white border-0 outline-none z-20"
                        />
                      ) : (
                        <span className="px-2 text-xs text-slate-700 truncate w-full">{val}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Bottom spacer */}
            <div style={{ height: Math.max(0, totalRows - endRow) * rowHeight }} />
          </div>
        </div>
      </div>
    </div>
  )
}
