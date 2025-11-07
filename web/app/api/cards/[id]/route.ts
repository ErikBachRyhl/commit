import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { ReviewStatus } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
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

    const body = await req.json().catch(() => ({}))
    const { status, front, back, isEdited } = body as {
      status?: ReviewStatus | "PENDING" | "ACCEPTED" | "DISCARDED"
      front?: string
      back?: string
      isEdited?: boolean
    }

    // Conditional update for status changes (idempotent)
    if (status === "ACCEPTED" || status === "DISCARDED") {
      // Only update if still pending (prevents double-accept/discard)
      const result = await prisma.cardSuggestion.updateMany({
        where: { id, status: "PENDING" },
        data: { status: status as ReviewStatus },
      })
      
      if (result.count === 0) {
        // Already updated by another request
        return NextResponse.json({ 
          ok: false, 
          reason: "already_updated" 
        }, { status: 409 })
      }
      
      const row = await prisma.cardSuggestion.findUnique({ where: { id } })
      return NextResponse.json({ ok: true, row })
    }
    
    // For edits, use regular update
    const data: any = {}
    if (status) data.status = status as ReviewStatus
    if (front !== undefined) data.frontEdited = front
    if (back !== undefined) data.backEdited = back
    if (isEdited !== undefined) data.isEdited = !!isEdited

    // If you edit text, mark edited
    if ((front !== undefined || back !== undefined) && data.isEdited === undefined) {
      data.isEdited = true
    }

    const row = await prisma.cardSuggestion.update({
      where: { id },
      data,
    })

    return NextResponse.json({ ok: true, row })
  } catch (err) {
    console.error("[API /cards/:id] Error:", err)
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}

