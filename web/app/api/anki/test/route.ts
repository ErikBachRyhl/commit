import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import AnkiConnectClient from '@/lib/anki-connect'

const TestConnectionSchema = z.object({
  url: z.string().url(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { url } = TestConnectionSchema.parse(body)

    // Create client and test connection
    const client = new AnkiConnectClient(url)
    
    const isAvailable = await client.ping()
    if (!isAvailable) {
      return NextResponse.json(
        {
          error: 'Unable to connect to AnkiConnect. Make sure Anki is running and AnkiConnect add-on is installed.',
        },
        { status: 503 }
      )
    }

    const version = await client.version()

    return NextResponse.json({
      success: true,
      version,
      message: 'Successfully connected to AnkiConnect',
    })
  } catch (error: any) {
    console.error('Error testing AnkiConnect connection:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to connect to AnkiConnect' },
      { status: 500 }
    )
  }
}

