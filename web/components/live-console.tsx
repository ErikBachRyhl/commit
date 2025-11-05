"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Terminal } from "lucide-react"
import AnsiToHtml from "ansi-to-html"

const ansiConverter = new AnsiToHtml({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
})

type LogEntry = {
  type: string
  data: string
  timestamp: string
}

export function LiveConsole({ runId }: { runId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<'connecting' | 'connected' | 'completed' | 'error'>('connecting')
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource(`/api/process/stream?runId=${runId}`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('connected', () => {
      setStatus('connected')
    })

    eventSource.addEventListener('stdout', (e) => {
      const data = JSON.parse(e.data)
      setLogs(prev => [...prev, { type: 'stdout', data: data.data, timestamp: data.timestamp }])
    })

    eventSource.addEventListener('stderr', (e) => {
      const data = JSON.parse(e.data)
      setLogs(prev => [...prev, { type: 'stderr', data: data.data, timestamp: data.timestamp }])
    })

    eventSource.addEventListener('exit', (e) => {
      const data = JSON.parse(e.data)
      setLogs(prev => [...prev, {
        type: 'exit',
        data: `Process exited with code ${data.data}`,
        timestamp: data.timestamp
      }])
    })

    eventSource.addEventListener('done', () => {
      setStatus('completed')
      eventSource.close()
    })

    eventSource.onerror = () => {
      setStatus('error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [runId])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [logs])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <CardTitle>Console Output</CardTitle>
          </div>
          <Badge variant={
            status === 'connected' ? 'default' :
            status === 'completed' ? 'secondary' :
            status === 'error' ? 'destructive' :
            'outline'
          }>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border bg-black p-4">
          <div className="font-mono text-sm text-white space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-400">Waiting for output...</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.type === 'stderr' ? 'text-red-400' :
                    log.type === 'exit' ? 'text-yellow-400' :
                    'text-gray-100'
                  }
                >
                  <span
                    dangerouslySetInnerHTML={{
                      __html: ansiConverter.toHtml(log.data)
                    }}
                  />
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

