import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getRepoContent } from '@/lib/github'
import { parseCommitYaml, normalizeConfig } from '@/lib/yaml'
import { prisma } from '@/lib/prisma'

const ImportYamlSchema = z.object({
  repoId: z.string(),
  branch: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { repoId, branch } = ImportYamlSchema.parse(body)

    // Get repo link
    const repoLink = await prisma.repoLink.findUnique({
      where: {
        id: repoId,
        userId: session.user.id,
      },
    })

    if (!repoLink) {
      return NextResponse.json(
        { error: 'Repository link not found' },
        { status: 404 }
      )
    }

    // Get GitHub access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'github',
      },
    })

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'GitHub account not connected' },
        { status: 400 }
      )
    }

    // Fetch commit.yml from repo
    const yamlContent = await getRepoContent(
      account.access_token,
      repoLink.owner,
      repoLink.repo,
      repoLink.yamlPath,
      branch || repoLink.defaultBranch
    )

    console.log('Fetched YAML content length:', yamlContent.length)
    console.log('First 200 chars:', yamlContent.substring(0, 200))

    // Parse and validate YAML
    const config = parseCommitYaml(yamlContent)
    console.log('Parsed config courses:', Object.keys(config.courses))
    
    const normalized = normalizeConfig(config)
    console.log('Normalized courses count:', normalized.courses.length)

    // Save to settings
    const settings = await prisma.settings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        courses: normalized.courses,
        llm: normalized.llm,
        parsing: normalized.parsing,
        cards: normalized.cards,
        rawYaml: yamlContent,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        courses: normalized.courses,
        llm: normalized.llm,
        parsing: normalized.parsing,
        cards: normalized.cards,
        rawYaml: yamlContent,
      },
    })

    return NextResponse.json({ 
      settings,
      message: 'Configuration imported successfully'
    })
  } catch (error: any) {
    console.error('Error importing YAML:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to import configuration' },
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

    const settings = await prisma.settings.findUnique({
      where: {
        userId: session.user.id,
      },
    })

    if (!settings) {
      return NextResponse.json(
        { error: 'No configuration found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

