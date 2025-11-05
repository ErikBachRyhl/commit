import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.settings.findUnique({
      where: { userId: session.user.id },
      select: { devMode: true },
    })

    return NextResponse.json({ devMode: settings?.devMode || false })
  } catch (error: any) {
    console.error('Error fetching dev mode status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch developer mode status' },
      { status: 500 }
    )
  }
}

