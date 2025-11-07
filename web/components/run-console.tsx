"use client"

import { useEffect, useRef, useState } from "react"
import stripAnsi from "strip-ansi"

type Line = { type: "LOG" | "ERR" | "CARD" | "EXIT" | "ERROR"; payload: string }
type TwoPassStats = { attempted: number; ok: number; fail: number } | null

export default function RunConsole({ runId }: { runId: string }) {
  const [lines, setLines] = useState<Line[]>([])
  const [twoPassStats, setTwoPassStats] = useState<TwoPassStats>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    // Prevent multiple stream connections (StrictMode, re-mounts)
    if (started.current) return
    started.current = true
    
    let abort = false

    async function go() {
      try {
        const res = await fetch(`/api/process/stream?runId=${encodeURIComponent(runId)}`)
        if (!res.ok) {
          setLines((prev) => [
            ...prev,
            { type: "ERROR", payload: `Stream failed: ${res.status} ${res.statusText}` },
          ])
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setLines((prev) => [...prev, { type: "ERROR", payload: "No stream available" }])
          return
        }

        const dec = new TextDecoder()

        while (!abort) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = dec.decode(value)
          for (const row of chunk.split("\n")) {
            if (!row.trim()) continue
            try {
              const line = JSON.parse(row) as Line
              setLines((prev) => [...prev, line])
              
              // Track two-pass stats
              if (line.type === "LOG" && line.payload.startsWith("2PASS SUMMARY")) {
                const match = line.payload.match(/attempted=(\d+)\s+ok=(\d+)\s+fail=(\d+)/)
                if (match) {
                  setTwoPassStats({
                    attempted: parseInt(match[1], 10),
                    ok: parseInt(match[2], 10),
                    fail: parseInt(match[3], 10),
                  })
                }
              }
            } catch (e) {
              console.warn("[RunConsole] Failed to parse line:", row, e)
            }
          }

          // Auto-scroll to bottom
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight
          }
        }
      } catch (error: any) {
        if (!abort) {
          setLines((prev) => [...prev, { type: "ERROR", payload: error.message }])
        }
      }
    }

    go()

    return () => {
      abort = true
      started.current = false
    }
  }, [runId])

  return (
    <div className="space-y-2">
      {twoPassStats && (
        <div className="text-xs text-slate-600 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-md">
          Two-pass fixes: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{twoPassStats.ok}/{twoPassStats.attempted}</span>
          {twoPassStats.fail > 0 && (
            <span className="ml-2 text-red-600 dark:text-red-400">(failed {twoPassStats.fail})</span>
          )}
        </div>
      )}
      <div
        ref={listRef}
        className="rounded-xl border bg-white dark:bg-slate-900 p-3 h-[280px] overflow-auto text-sm font-mono"
      >
        {lines.length === 0 && (
          <div className="text-slate-500 dark:text-slate-400">Waiting for output...</div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <span
              className={
                l.type === "CARD"
                  ? "px-2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold"
                  : l.type === "ERR" || l.type === "ERROR"
                  ? "px-2 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold"
                  : l.type === "EXIT"
                  ? "px-2 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold"
                  : "px-2 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              {l.type}
            </span>
            <span className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all">
              {stripAnsi(l.payload)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

