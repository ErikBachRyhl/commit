import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listUserRepos } from '@/lib/github'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get GitHub access token from account
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

    const repos = await listUserRepos(account.access_token)
    
    return NextResponse.json({ repos })
  } catch (error: any) {
    console.error('Error fetching repos:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}

