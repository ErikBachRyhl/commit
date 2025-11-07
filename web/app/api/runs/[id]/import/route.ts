import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AnkiConnectClient } from '@/lib/anki-connect'

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params

  try {
    // Get ACCEPTED cards first
    const accepted = await prisma.cardSuggestion.findMany({
      where: { runId, status: 'ACCEPTED' },
      orderBy: { idx: 'asc' },
    })
    
    // Filter client-side for "not yet imported" by metadata.noteId
    // (noteId column doesn't exist in Prisma model, so we use metadata)
    const toImport = accepted.filter(c => !(c.metadata as any)?.noteId)

    if (toImport.length === 0) {
      return NextResponse.json({ 
        imported: 0, 
        skipped: accepted.length,
        message: 'No new cards to import (all accepted cards already imported or none accepted)' 
      })
    }

    // Initialize AnkiConnect client
    const ankiUrl = process.env.ANKICONNECT_URL || 'http://127.0.0.1:8765'
    const anki = new AnkiConnectClient(ankiUrl)

    // Check connection
    const isConnected = await anki.ping()
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Cannot connect to Anki. Make sure Anki is running with AnkiConnect installed.' },
        { status: 503 }
      )
    }

    // Group cards by deck
    const defaultDeck = process.env.DEFAULT_DECK || 'Commit'
    const byDeck: Record<string, typeof toImport> = {}
    
    for (const card of toImport) {
      // Get deck from metadata (where we now store it), or fall back to course, or use Default
      const deck = (card.metadata as any)?.deck || (card.metadata as any)?.course || defaultDeck
      ;(byDeck[deck] ||= []).push(card)
    }

    let totalImported = 0
    const details: Array<{ deck: string; added: number; noteIds: Array<number | null> }> = []

    // Process each deck
    for (const [deckName, deckCards] of Object.entries(byDeck)) {
      try {
        // Create deck if it doesn't exist
        await anki.createDeck(deckName)

        // Prepare notes for AnkiConnect
        const notes = deckCards.map((card) => {
          const front = card.frontEdited || card.front
          const back = card.backEdited || card.back
          
          // Use concept tag as GUID for strong de-duplication
          const conceptTag = card.tags?.find((t: string) => t.startsWith('concept:'))
          const guid = conceptTag ? conceptTag.slice(8) : undefined

          return {
            deckName,
            modelName: card.cardType === 'cloze' ? 'Cloze' : 'Basic',
            fields: {
              Front: front,
              Back: back,
            },
            options: { 
              allowDuplicate: false, // Prevent duplicates
              duplicateScope: 'deck',
              duplicateScopeOptions: {
                deckName,
                checkChildren: false,
                checkAllModels: false,
              },
            },
            tags: [
              ...(card.tags || []),
              'from-commit',
              `run:${runId}`,
            ],
            ...(guid ? { guid } : {}),
          }
        })

        // Add notes in batch
        const noteIds = await anki.addNotes(notes)
        
        details.push({ 
          deck: deckName, 
          added: noteIds.filter(Boolean).length, 
          noteIds 
        })

        // Update metadata.noteId for only those actually added
        for (let i = 0; i < deckCards.length; i++) {
          const noteId = noteIds[i]
          if (noteId) {
            // Store noteId in metadata (not as top-level column)
            const meta = {
              ...(deckCards[i].metadata as any),
              noteId,
              importedAt: new Date().toISOString(),
            }
            await prisma.cardSuggestion.update({
              where: { id: deckCards[i].id },
              data: { metadata: meta },
            })
            totalImported++
          }
        }
      } catch (error: any) {
        console.error(`Error importing to deck ${deckName}:`, error)
        details.push({ deck: deckName, added: 0, noteIds: [] })
      }
    }

    const skipped = toImport.length - totalImported
    return NextResponse.json({
      imported: totalImported,
      skipped,
      details,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import cards' },
      { status: 500 }
    )
  }
}
