import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getRepoDefaultBranch, checkRepoAccess } from '@/lib/github'
import { prisma } from '@/lib/prisma'

const LinkRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  yamlPath: z.string().optional().default('commit.yml'),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { owner, repo, yamlPath } = LinkRepoSchema.parse(body)

    // Get GitHub access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'github',
      },
    })

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'GitHub account not connected' },
        { status: 400 }
      )
    }

    // Verify access to repo
    const hasAccess = await checkRepoAccess(account.access_token, owner, repo)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No access to repository or repository not found' },
        { status: 403 }
      )
    }

    // Get default branch
    const defaultBranch = await getRepoDefaultBranch(account.access_token, owner, repo)

    // Create or update repo link
    const userId = session.user.id!
    const repoLink = await prisma.repoLink.upsert({
      where: {
        userId_owner_repo: {
          userId,
          owner,
          repo,
        },
      },
      update: {
        yamlPath,
        defaultBranch,
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider: 'github',
        owner,
        repo,
        yamlPath,
        defaultBranch,
      },
    })

    return NextResponse.json({ repoLink })
  } catch (error: any) {
    console.error('Error linking repo:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to link repository' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const repoLinks = await prisma.repoLink.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json({ repoLinks })
  } catch (error: any) {
    console.error('Error fetching repo links:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch repository links' },
      { status: 500 }
    )
  }
}

