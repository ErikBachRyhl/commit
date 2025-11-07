import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify card belongs to user (through run)
    const suggestion = await prisma.cardSuggestion.findFirst({
      where: {
        id,
        run: {
          userId: session.user.id,
        },
      },
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    // Update card status to accepted
    await prisma.cardSuggestion.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    })

    // Create action record
    await prisma.cardAction.create({
      data: {
        suggestionId: id,
        action: 'add',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Card marked as accepted'
    })
  } catch (error: any) {
    console.error('Error adding card:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add card' },
      { status: 500 }
    )
  }
}

