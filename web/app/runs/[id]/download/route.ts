import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { spawnCLI } from "@/lib/spawn"
import { readFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: runId } = await params

    // Get accepted cards for this run
    const rows = await prisma.cardSuggestion.findMany({
      where: { runId, status: "ACCEPTED" },
      orderBy: { idx: "asc" },
    })

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "no_accepted" },
        { status: 400 }
      )
    }

    const repoPath = process.env.NOTES_REPO_PATH || process.env.LOCAL_REPO_PATH
    if (!repoPath) {
      return NextResponse.json(
        { ok: false, error: "NOTES_REPO_PATH not configured" },
        { status: 500 }
      )
    }

    // Map rows -> CLI input format
    const payload = rows.map((r) => {
      const metadata = (r.metadata || {}) as any
      return {
        front: r.isEdited && r.frontEdited ? r.frontEdited : r.front,
        back: r.isEdited && r.backEdited ? r.backEdited : r.back,
        tags: r.tags,
        cardType: r.cardType,
        ...metadata,
      }
    })

    const outPath = join(tmpdir(), `commit-${runId}.apkg`)

    const { code, stderr } = await spawnCLI({
      args: [
        "build-apkg-selected",
        "--repo",
        repoPath,
        "--input",
        "-",
        "--output",
        outPath,
      ],
      stdin: JSON.stringify(payload),
      cwd: process.cwd(),
    })

    if (code !== 0) {
      console.error("[API /runs/:id/download] CLI failed:", stderr)
      return NextResponse.json(
        { ok: false, error: "cli_failed", stderr },
        { status: 500 }
      )
    }

    const buf = await readFile(outPath)

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="notes-${runId}.apkg"`,
      },
    })
  } catch (error: any) {
    console.error("[API /runs/:id/download] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to download .apkg" },
      { status: 500 }
    )
  }
}

