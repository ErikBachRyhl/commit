import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DevModeSchema = z.object({
  devMode: z.boolean(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { devMode } = DevModeSchema.parse(body)

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { userId: session.user.id },
      update: { devMode },
      create: {
        userId: session.user.id,
        courses: [],
        llm: {},
        parsing: {},
        cards: {},
        devMode,
      },
    })

    return NextResponse.json({ success: true, devMode: settings.devMode })
  } catch (error: any) {
    console.error('Error updating dev mode:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update developer mode' },
      { status: 500 }
    )
  }
}

