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
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const ProcessSchema = z.object({
  repoId: z.string(),
  sinceSha: z.string().optional(),
  offline: z.boolean().optional().default(false), // Default to live injection (Process & Send mode)
  enableLlm: z.boolean().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  force: z.boolean().optional().default(false), // Force reprocess (dev mode)
})

export async function POST(req: NextRequest) {
  console.log('============================================')
  console.log('[API /process] POST request received')
  try {
    const session = await getSession()
    console.log('[API /process] Session:', session?.user?.email)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('[API /process] Request body:', JSON.stringify(body, null, 2))
    const options = ProcessSchema.parse(body)
    console.log('[API /process] Parsed options:', options)
    if (options.force) {
      console.log('[API /process] 🔥 FORCE MODE: Will reprocess commits regardless of cache state')
    }

    // Get repo link
    console.log('[API /process] Fetching repo link...')
    const repoLink = await prisma.repoLink.findUnique({
      where: {
        id: options.repoId,
        userId: session.user.id,
      },
    })
    console.log('[API /process] Repo link found:', repoLink?.repo)

    if (!repoLink) {
      console.log('[API /process] ERROR: Repo link not found')
      return NextResponse.json(
        { error: 'Repository link not found' },
        { status: 404 }
      )
    }

    // Check for existing running process for this repo
    console.log('[API /process] Checking for existing runs...')
    const existingRun = await prisma.processingRun.findFirst({
      where: {
        userId: session.user.id,
        repoId: options.repoId,
        status: 'running',
      },
    })

    if (existingRun) {
      console.log('[API /process] ERROR: Process already running')
      return NextResponse.json(
        { error: 'A process is already running for this repository', runId: existingRun.id },
        { status: 409 }
      )
    }

    // Create processing run record
    console.log('[API /process] Creating run record...')
    const userId = session.user.id!
    const run = await prisma.processingRun.create({
      data: {
        userId,
        repoId: options.repoId,
        status: 'queued',
        logs: [],
      },
    })
    console.log('[API /process] Run created:', run.id)

    // Create temporary directory for this run
    const tempDir = path.join(os.tmpdir(), `commit-${run.id}`)
    await fs.mkdir(tempDir, { recursive: true })
    console.log('[API /process] Temp dir created:', tempDir)

    // Get the repo path from environment or use the temp directory
    // For local development, set LOCAL_REPO_PATH to your actual learning repo
    // Example: LOCAL_REPO_PATH=/Users/erik/Documents/Studie/learning
    const repoPath = process.env.LOCAL_REPO_PATH
    console.log('[API /process] Repo path:', repoPath)

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
    console.log('[API /process] Checking for commit.yml at:', repoConfigPath)
    try {
      await fs.access(repoConfigPath)
      console.log('[API /process] commit.yml found')
    } catch (error) {
      console.log('[API /process] ERROR: commit.yml not found')
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

    // Clear CLI state file for fresh processing
    const stateFile = path.join(os.homedir(), '.commit_state.json')
    try {
      await fs.unlink(stateFile)
      console.log('Cleared CLI state file for fresh processing')
    } catch (error) {
      // State file doesn't exist, that's fine
      if ((error as any).code !== 'ENOENT') {
        console.warn(`Could not clear state file: ${error}`)
      }
    }

    // If sinceSha is provided, get its parent to process that specific commit
    // The CLI's --since means "from SHA to HEAD", so we need the parent
    let actualSinceSha = options.sinceSha
    if (options.sinceSha) {
      try {
        const { stdout } = await execAsync(`git rev-parse ${options.sinceSha}^`, { cwd: repoPath })
        actualSinceSha = stdout.trim()
        console.log(`Using parent SHA ${actualSinceSha} to process commit ${options.sinceSha}`)
      } catch (error) {
        // No parent (first commit) or invalid SHA - use as-is
        console.log(`Using original SHA ${options.sinceSha} (no parent or first commit)`)
      }
    }

    // Spawn CLI process
    try {
      // For Process & Send mode: enable JSONL streaming and live injection
      // For Build APKG mode: use offline, no JSONL needed
      const spawnOptions = {
        repoPath,
        offline: options.offline,
        output: outputPath,
        sinceSha: actualSinceSha,
        enableLlm: options.enableLlm ?? true, // Default to enabled
        provider: options.provider,
        model: options.model,
        ...(options.offline ? {} : {
          // Only enable JSONL streaming for live injection mode
          jsonlOut: '-' as const,
          runId: run.id,
          syncMode: 'disabled', // Disable auto-import for web review flow
        }),
      }
      
      console.log('[API /process] Spawning CLI with options:', JSON.stringify({
        ...spawnOptions,
        runId: spawnOptions.runId || '(not set)',
      }, null, 2))
      
      const cliProcess = spawnCLIProcess(spawnOptions)

      // Register process for SSE streaming
          registerProcess(run.id, cliProcess)

          // Update run status to running
          await updateProcessingRun(run.id, {
            status: 'running',
            startedAt: new Date(),
          })

      // Handle CLI process events (stdout, stderr, exit)
      let stdoutBuffer = ''
      cliProcess.onData(async (event) => {
        // Parse JSONL output for card data
        if (event.type === 'stdout') {
          const chunk = String(event.data)
          stdoutBuffer += chunk
          
          // Process complete lines (handle chunks that may split mid-line)
          let newlineIndex
          while ((newlineIndex = stdoutBuffer.indexOf('\n')) >= 0) {
            const line = stdoutBuffer.slice(0, newlineIndex)
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
            
            if (line.startsWith('CARD\t')) {
              const jsonStr = line.slice(5).trim()
              try {
                const card = JSON.parse(jsonStr)
                // Move deck into metadata (Prisma schema doesn't have deck at top level)
                const metadata = {
                  env: card.env,
                  course: card.course,
                  slot: card.slot,
                  blockGuid: card.blockGuid,
                  blockGuidShort: card.blockGuidShort,
                  noteGuid: card.noteGuid,
                  action: card.action,
                  ...(card.deck ? { deck: card.deck } : {}),
                }
                
                // Save to CardSuggestion table (existing model)
                await prisma.cardSuggestion.create({
                  data: {
                    runId: card.runId || run.id, // Fallback to run.id if not in card
                    idx: card.idx ?? 0,
                    front: card.front || '',
                    back: card.back || '',
                    tags: Array.isArray(card.tags) ? card.tags : [],
                    cardType: card.cardType || 'basic',
                    sourceFile: card.sourceFile || null,
                    sourceLine: card.sourceLine || null,
                    status: 'PENDING',
                    metadata,
                  },
                })
                console.log(`[API /process] ✅ Saved card ${card.idx ?? '?'}: ${card.blockGuidShort || 'unknown'}`)
              } catch (error) {
                console.error('[API /process] ❌ Failed to parse/save card JSON:', error)
                console.error('[API /process] Raw line:', jsonStr.substring(0, 200))
              }
            }
          }
        }
        
        // Handle process completion
        if (event.type === 'exit') {
              const success = event.data === 0

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

