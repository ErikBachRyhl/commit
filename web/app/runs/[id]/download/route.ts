import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the run
    const run = await prisma.processingRun.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        repo: true,
      },
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    if (!run.apkgPath) {
      return NextResponse.json(
        { error: '.apkg file not found for this run' },
        { status: 404 }
      )
    }

    // Read the .apkg file
    try {
      const fileBuffer = await readFile(run.apkgPath)
      
      // Generate filename
      const repoName = run.repo ? `${run.repo.owner}-${run.repo.repo}` : 'notes'
      const timestamp = new Date().toISOString().slice(0, 10)
      const filename = `${repoName}-${timestamp}.apkg`

      // Return as download
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/x-anki-deck',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      })
    } catch (error) {
      console.error('Error reading .apkg file:', error)
      return NextResponse.json(
        { error: '.apkg file not accessible' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error downloading .apkg:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download .apkg' },
      { status: 500 }
    )
  }
}

