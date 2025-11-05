import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProcess, getProcessEvents } from '@/lib/process-manager'
import { createSSEStream, getSSEHeaders } from '@/lib/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')

    if (!runId) {
      return NextResponse.json(
        { error: 'runId parameter is required' },
        { status: 400 }
      )
    }

    // Verify run belongs to user
    const run = await prisma.processingRun.findUnique({
      where: {
        id: runId,
        userId: session.user.id,
      },
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // Get the process info
    const processInfo = getProcess(runId)
    
    // If process doesn't exist in memory, send completed status with historical logs
    if (!processInfo) {
      const stream = createSSEStream((send) => {
        send({
          event: 'status',
          data: {
            status: run.status,
            message: run.status === 'succeeded' ? 'Process completed' : 'Process ended',
          },
        })

        send({
          event: 'done',
          data: {
            status: run.status,
            timestamp: new Date().toISOString(),
          },
        })
      })

      return new NextResponse(stream, {
        headers: getSSEHeaders(),
      })
    }

    // Stream process events
    const stream = createSSEStream((send) => {
      // Send existing events first
      const existingEvents = getProcessEvents(runId)
      existingEvents.forEach(event => {
        send({
          event: event.type,
          data: {
            type: event.type,
            data: event.data,
            timestamp: event.timestamp.toISOString(),
          },
        })
      })

      // Listen for new events
      processInfo.process.onData((event) => {
        send({
          event: event.type,
          data: {
            type: event.type,
            data: event.data,
            timestamp: event.timestamp.toISOString(),
          },
        })

        // Send done event on exit
        if (event.type === 'exit') {
          send({
            event: 'done',
            data: {
              code: event.data,
              status: event.data === 0 ? 'succeeded' : 'failed',
              timestamp: new Date().toISOString(),
            },
          })
        }
      })

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        send({
          event: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
        })
      }, 15000) // Every 15 seconds

      // Clean up on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
      })
    })

    return new NextResponse(stream, {
      headers: getSSEHeaders(),
    })
  } catch (error: any) {
    console.error('Error streaming process:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to stream process' },
      { status: 500 }
    )
  }
}

