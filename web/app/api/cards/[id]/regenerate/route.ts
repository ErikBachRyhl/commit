import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { callLLMRewriteVariant } from "@/lib/llm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 })
    }

    const row = await prisma.cardSuggestion.findUnique({
      where: { id },
    })

    if (!row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    const front0 = row.isEdited && row.frontEdited ? row.frontEdited : row.front
    const back0 = row.isEdited && row.backEdited ? row.backEdited : row.back

    const { front, back } = await callLLMRewriteVariant({
      env: (row.metadata as any)?.env,
      slot: (row.metadata as any)?.slot,
      course: (row.metadata as any)?.course,
      front: front0,
      back: back0,
    })

    const updated = await prisma.cardSuggestion.update({
      where: { id },
      data: {
        frontEdited: front,
        backEdited: back,
        isEdited: true,
        regenCount: { increment: 1 },
      },
    })

    return NextResponse.json({ ok: true, row: updated })
  } catch (err) {
    console.error("[API /cards/:id/regenerate] Error:", err)
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}

