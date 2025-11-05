import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateProcessingRun } from '@/lib/db-helpers'
import { spawnCLIProcess } from '@/lib/cli'
import { registerProcess } from '@/lib/process-manager'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const ProcessSchema = z.object({
  repoId: z.string(),
  sinceSha: z.string().optional(),
  offline: z.boolean().optional().default(true), // Default to offline for MVP
  enableLlm: z.boolean().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const options = ProcessSchema.parse(body)

    // Get repo link
    const repoLink = await prisma.repoLink.findUnique({
      where: {
        id: options.repoId,
        userId: session.user.id,
      },
    })

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link not found' },
        { status: 404 }
      )
    }

    // Check for existing running process for this repo
    const existingRun = await prisma.processingRun.findFirst({
      where: {
        userId: session.user.id,
        repoId: options.repoId,
        status: 'running',
      },
    })

    if (existingRun) {
      return NextResponse.json(
        { error: 'A process is already running for this repository', runId: existingRun.id },
        { status: 409 }
      )
    }

    // Create processing run record
    const userId = session.user.id!
    const run = await prisma.processingRun.create({
      data: {
        userId,
        repoId: options.repoId,
        status: 'queued',
        logs: [],
      },
    })

    // Create temporary directory for this run
    const tempDir = path.join(os.tmpdir(), `commit-${run.id}`)
    await fs.mkdir(tempDir, { recursive: true })

    // Get the repo path from environment or use the temp directory
    // For local development, set LOCAL_REPO_PATH to your actual learning repo
    // Example: LOCAL_REPO_PATH=/Users/erik/Documents/Studie/learning
    const repoPath = process.env.LOCAL_REPO_PATH

    if (!repoPath) {
      throw new Error(
        'LOCAL_REPO_PATH environment variable is required. ' +
        'Set it to the absolute path of your local learning repository. ' +
        'Example: LOCAL_REPO_PATH=/Users/erik/Documents/Studie/learning'
      )
    }

    // For MVP: The Python CLI expects commit.yml in the repo directory
    // Make sure it exists
    const repoConfigPath = path.join(repoPath, 'commit.yml')
    try {
      await fs.access(repoConfigPath)
    } catch (error) {
      throw new Error(
        `No commit.yml found in ${repoPath}. ` +
        `Please create a commit.yml file in your repository root. ` +
        `You can use the imported settings as a reference in the Settings page.`
      )
    }

    // Prepare output path for .apkg if offline mode
    const outputPath = options.offline
      ? path.join(tempDir, 'notes.apkg')
      : undefined

    // Temporarily move state file to force reprocessing when using --since
    const homeDir = os.homedir()
    const stateFile = path.join(homeDir, '.commit_state.json')
    const stateBackup = path.join(homeDir, '.commit_state.backup.json')
    let stateFileMoved = false

    if (options.sinceSha) {
      try {
        await fs.access(stateFile)
        await fs.rename(stateFile, stateBackup)
        stateFileMoved = true
        console.log('Temporarily moved state file to force reprocessing')
      } catch {
        // State file doesn't exist, that's fine
      }
    }

    // Spawn CLI process
    try {
      const cliProcess = spawnCLIProcess({
        repoPath,
        offline: options.offline,
        output: outputPath,
        sinceSha: options.sinceSha,
        enableLlm: options.enableLlm,
        provider: options.provider,
        model: options.model,
      })

      // Register process for SSE streaming
          registerProcess(run.id, cliProcess)

          // Update run status to running
          await updateProcessingRun(run.id, {
            status: 'running',
            startedAt: new Date(),
          })

      // Handle process completion in background
          cliProcess.onData(async (event) => {
            if (event.type === 'exit') {
              const success = event.data === 0

              // Restore state file if we moved it
              if (stateFileMoved) {
                try {
                  await fs.rename(stateBackup, stateFile)
                  console.log('Restored state file')
                } catch (error) {
                  console.error('Failed to restore state file:', error)
                }
              }

              try {
                await updateProcessingRun(run.id, {
                  status: success ? 'succeeded' : 'failed',
                  endedAt: new Date(),
                  apkgPath: success && outputPath ? outputPath : undefined,
                })
              } catch (error) {
                console.error('Failed to update run status:', error)
              }

              // Cleanup temp directory (keep output file if it exists)
              try {
                if (outputPath) {
                  // Move output file before cleanup
                  const finalOutputPath = path.join(os.tmpdir(), `notes-${run.id}.apkg`)
                  try {
                    await fs.rename(outputPath, finalOutputPath)
                    // Update DB with final path (with retry)
                    await updateProcessingRun(run.id, {
                      apkgPath: finalOutputPath,
                    })
                  } catch {
                    // Output file might not exist if no cards were generated
                  }
                }
                
                // Clean up temp directory
                await fs.rm(tempDir, { recursive: true, force: true })
              } catch (error) {
                console.error('Failed to cleanup temp directory:', error)
              }
            }
          })

      return NextResponse.json({
        runId: run.id,
        status: 'running',
        message: 'Processing started'
      })
    } catch (error: any) {
      // Failed to start process
      
      // Restore state file if we moved it
      if (stateFileMoved) {
        try {
          await fs.rename(stateBackup, stateFile)
          console.log('Restored state file after error')
        } catch (restoreError) {
          console.error('Failed to restore state file:', restoreError)
        }
      }

      try {
        await updateProcessingRun(run.id, {
          status: 'failed',
          endedAt: new Date(),
        })
      } catch (dbError) {
        console.error('Failed to update run status to failed:', dbError)
      }

      throw error
    }
  } catch (error: any) {
    console.error('Error starting process:', error)
    
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request data', details: error.issues },
            { status: 400 }
          )
        }
    
    return NextResponse.json(
      { error: error.message || 'Failed to start processing' },
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

    const runs = await prisma.processingRun.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        repo: true,
      },
    })

    return NextResponse.json({ runs })
  } catch (error: any) {
    console.error('Error fetching runs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch runs' },
      { status: 500 }
    )
  }
}

