import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createJob } from '@/lib/job-queue'
import { processJob } from '@/lib/job-worker'

const CreateJobSchema = z.object({
  type: z.string(),
  selector: z.object({
    commit_ids: z.array(z.string()).optional(),
    course_id: z.string().optional(),
    date_range: z.object({
      from: z.coerce.date(),
      to: z.coerce.date()
    }).optional()
  }),
  force: z.boolean().optional().default(false),
  repoPath: z.string() // Required for processing
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await req.json()
    const { type, selector, force, repoPath } = CreateJobSchema.parse(body)
    
    // Create job (idempotent)
    const jobId = await createJob(session.user.id!, type, selector, force)
    
    // Start processing in background (don't await)
    processJob(jobId, repoPath).catch(error => {
      console.error(`Background job ${jobId} failed:`, error)
    })
    
    return NextResponse.json({ 
      jobId,
      message: 'Job queued successfully' 
    })
    
  } catch (error: any) {
    console.error('Error creating job:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: 500 }
    )
  }
}

