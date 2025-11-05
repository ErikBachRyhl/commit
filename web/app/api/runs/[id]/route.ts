import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const run = await prisma.processingRun.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        repo: true,
        suggestions: {
          orderBy: {
            idx: 'asc',
          },
        },
      },
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ run })
  } catch (error: any) {
    console.error('Error fetching run:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch run' },
      { status: 500 }
    )
  }
}

