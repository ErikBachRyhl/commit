import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRecentCommits } from '@/lib/git'
import { z } from 'zod'

const CommitsQuerySchema = z.object({
  repoId: z.string(),
  limit: z.coerce.number().optional().default(20),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const params = CommitsQuerySchema.parse({
      repoId: searchParams.get('repoId'),
      limit: searchParams.get('limit'),
    })

    // Verify repo ownership
    const repoLink = await prisma.repoLink.findUnique({
      where: {
        id: params.repoId,
        userId: session.user.id,
      },
    })

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link not found' },
        { status: 404 }
      )
    }

    // Get LOCAL_REPO_PATH
    const repoPath = process.env.LOCAL_REPO_PATH

    if (!repoPath) {
      return NextResponse.json(
        { error: 'LOCAL_REPO_PATH not configured' },
        { status: 500 }
      )
    }

    // Fetch commits from local repo
    const commits = await getRecentCommits(repoPath, params.limit)

    return NextResponse.json({ commits })
  } catch (error: any) {
    console.error('Error fetching commits:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch commits' },
      { status: 500 }
    )
  }
}

