export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getProcess, getProcessEvents } from "@/lib/process-manager"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// Strip ANSI color codes and spinner junk
function stripAnsi(s: string): string {
  return s
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
    .replace(/\?\d{2}l|\r/g, "")
    .trim()
}

// Extract concept tag from tags array
function conceptTagOf(tags?: string[] | null): string | null {
  return tags?.find(t => t.startsWith("concept:")) ?? null
}

// Generate stable concept key from front/back content
function conceptKeyFrom(front: string, back: string): string {
  const t = (front + "\n" + back)
    .replace(/\\[a-zA-Z]+(\{.*?\})*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
  return crypto.createHash("sha1").update(t).digest("hex").slice(0, 16)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get("runId") || ""

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let lastEventIndex = 0

      const send = (type: string, payload: string) => {
        if (closed) return
        try {
          const line = JSON.stringify({ type, payload }) + "\n"
          controller.enqueue(new TextEncoder().encode(line))
        } catch (error) {
          // Controller is closed or errored, stop trying to send
          closed = true
        }
      }

      const cleanup = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      // Poll for new events from the registered process
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval)
          return
        }

        const events = getProcessEvents(runId)
        
        // Send any new events since last check
        for (let i = lastEventIndex; i < events.length; i++) {
          const event = events[i]
          
          if (event.type === 'stdout') {
            const text = String(event.data)
            for (const raw of text.split(/\r?\n/)) {
              if (!raw.trim()) continue
              
              if (raw.startsWith("CARD\t")) {
                const json = raw.slice(5)
                try {
                  const data = JSON.parse(json)
                  
                  // Idempotent upsert: dedupe by concept tag or content hash
                  const conceptTag = conceptTagOf(data.tags)
                  const conceptKey = conceptTag ? conceptTag.slice(8) : conceptKeyFrom(data.front, data.back)
                  
                  // Build where clause for finding existing card
                  const where = conceptTag
                    ? { runId, tags: { has: conceptTag } }
                    : { runId, front: data.front, back: data.back }
                  
                  const existing = await prisma.cardSuggestion.findFirst({ where })
                  
                  // Build metadata (Prisma schema doesn't have deck at top level)
                  const metadata = {
                    env: data.env,
                    course: data.course,
                    slot: data.slot,
                    blockGuid: data.blockGuid,
                    blockGuidShort: data.blockGuidShort,
                    noteGuid: data.noteGuid,
                    action: data.action,
                    conceptKey,
                    ...(data.deck ? { deck: data.deck } : {}),
                  }
                  
                  if (existing) {
                    // Idempotent: update metadata but keep status
                    await prisma.cardSuggestion.update({
                      where: { id: existing.id },
                      data: { metadata },
                    })
                    console.log(`[Stream] ♻️ Updated existing card ${data.idx}: ${data.blockGuidShort || 'unknown'}`)
                  } else {
                    // New card: create with concept tag
                    const tags = Array.isArray(data.tags) ? data.tags : []
                    if (!conceptTag) {
                      tags.push(`concept:${conceptKey}`)
                    }
                    
                    await prisma.cardSuggestion.create({
                      data: {
                        runId,
                        idx: data.idx ?? 0,
                        front: data.front || '',
                        back: data.back || '',
                        cardType: data.cardType || 'basic',
                        tags,
                        sourceFile: data.sourceFile || null,
                        sourceLine: data.sourceLine ?? null,
                        status: 'PENDING',
                        metadata,
                      },
                    })
                    console.log(`[Stream] ✅ Created card ${data.idx}: ${data.blockGuidShort || 'unknown'}`)
                  }
                  
                  send("CARD", json) // Forward to client
                } catch (e: any) {
                  console.error('[Stream] ❌ Failed to save card:', e?.message)
                  send("ERR", "DB_SAVE_FAILED " + (e?.message || ""))
                }
              } else if (raw.startsWith("LOG\t")) {
                const line = stripAnsi(raw.slice(4))
                if (line) send("LOG", line)
              } else {
                // Pretty logs: strip ANSI + drop spinner junk
                const line = stripAnsi(raw)
                if (line) send("LOG", line)
              }
            }
          } else if (event.type === 'stderr') {
            const line = stripAnsi(String(event.data))
            if (line) send("ERR", line)
          } else if (event.type === 'exit') {
            send("EXIT", String(event.data))
            cleanup()
            clearInterval(pollInterval)
          } else if (event.type === 'error') {
            send("ERROR", String(event.data))
            cleanup()
            clearInterval(pollInterval)
          }
        }
        
        lastEventIndex = events.length
        
        // Check if process is done
        const processInfo = getProcess(runId)
        if (processInfo && processInfo.status !== 'running') {
          cleanup()
          clearInterval(pollInterval)
        }
      }, 500) // Poll every 500ms

      // Handle client disconnect
      return () => {
        cleanup()
        clearInterval(pollInterval)
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
