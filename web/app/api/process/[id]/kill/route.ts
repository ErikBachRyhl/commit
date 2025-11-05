import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProcess, unregisterProcess } from '@/lib/process-manager'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const runId = params.id

    // Verify ownership
    const run = await prisma.processingRun.findUnique({
      where: {
        id: runId,
        userId: session.user.id,
      },
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Processing run not found' },
        { status: 404 }
      )
    }

    // Kill the process if it's still registered
    const processInfo = getProcess(runId)
    if (processInfo) {
      processInfo.process.kill()
      unregisterProcess(runId)
    }

    // Update status in database
    await prisma.processingRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        endedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Process killed successfully',
      status: 'failed',
    })
  } catch (error: any) {
    console.error('Error killing process:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to kill process' },
      { status: 500 }
    )
  }
}

