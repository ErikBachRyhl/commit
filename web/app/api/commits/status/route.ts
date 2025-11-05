import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getCommitStatuses } from '@/lib/job-queue'

const CommitStatusSchema = z.object({
  commitShas: z.array(z.string())
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await req.json()
    const { commitShas } = CommitStatusSchema.parse(body)
    
    // Get statuses for all commits
    const statusMap = await getCommitStatuses(commitShas)
    
    // Convert Map to array format for JSON response
    const statuses = commitShas.map(sha => ({
      sha,
      status: statusMap.get(sha) || 'new'
    }))
    
    return NextResponse.json({ statuses })
    
  } catch (error: any) {
    console.error('Error fetching commit statuses:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch commit statuses' },
      { status: 500 }
    )
  }
}

