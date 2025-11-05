import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RunDetailContent } from "@/components/run-detail-content"

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  const run = await prisma.processingRun.findUnique({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      repo: true,
      suggestions: {
        where: {
          state: {
            not: 'discarded',
          },
        },
        orderBy: {
          idx: 'asc',
        },
      },
    },
  })

  if (!run) {
    redirect('/')
  }

  return <RunDetailContent run={run} />
}

