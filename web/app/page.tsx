import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DashboardContent } from "@/components/dashboard-content"

export default async function HomePage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch user's repo links and settings
  const [repoLinks, settings, recentRuns] = await Promise.all([
    prisma.repoLink.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    }),
    prisma.settings.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.processingRun.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        repo: true,
      },
    }),
  ])

  const linkedRepo = repoLinks[0] || null

  return (
    <DashboardContent
      user={session.user as any}
      linkedRepo={linkedRepo}
      settings={settings}
      recentRuns={recentRuns}
    />
  )
}
