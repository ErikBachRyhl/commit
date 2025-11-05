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
    
    // Fetch job with commit runs
    const job = await prisma.job.findUnique({
      where: { 
        id,
        createdBy: session.user.id // Ensure user owns this job
      },
      include: { 
        commitRuns: {
          orderBy: { createdAt: 'desc' }
        } 
      }
    })
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ job })
    
  } catch (error: any) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

