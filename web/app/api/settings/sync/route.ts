import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SyncSettingsSchema = z.object({
  syncTarget: z.enum(['apkg', 'ankiconnect']),
  ankiConnectUrl: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { syncTarget, ankiConnectUrl } = SyncSettingsSchema.parse(body)

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { userId: session.user.id },
      update: {
        syncTarget,
        ankiConnectUrl: ankiConnectUrl || 'http://localhost:8765',
      },
      create: {
        userId: session.user.id,
        courses: [],
        llm: {},
        parsing: {},
        cards: {},
        syncTarget,
        ankiConnectUrl: ankiConnectUrl || 'http://localhost:8765',
      },
    })

    return NextResponse.json({
      success: true,
      syncTarget: settings.syncTarget,
      ankiConnectUrl: settings.ankiConnectUrl,
    })
  } catch (error: any) {
    console.error('Error updating sync settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update sync settings' },
      { status: 500 }
    )
  }
}

