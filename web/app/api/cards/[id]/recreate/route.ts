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
      include: {
        run: {
          include: {
            repo: true,
          },
        },
      },
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    // For MVP, we'll just log the recreate request
    // In a full implementation, we would:
    // 1. Extract the source block info from the card
    // 2. Call the CLI with LLM generation for just that block
    // 3. Create new card suggestions with the results

    // Create action record
    await prisma.cardAction.create({
      data: {
        suggestionId: id,
        action: 'recreate',
        payload: {
          sourceFile: suggestion.sourceFile,
          sourceLine: suggestion.sourceLine,
          originalFront: suggestion.front,
          originalBack: suggestion.back,
        },
      },
    })

    // For MVP, return a message that this feature is coming soon
    return NextResponse.json({
      success: true,
      message: 'Recreate request logged. This feature will regenerate the card with a new LLM prompt.',
      // In production: return new card suggestions here
    })
  } catch (error: any) {
    console.error('Error recreating card:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recreate card' },
      { status: 500 }
    )
  }
}

