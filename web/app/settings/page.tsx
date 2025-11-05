import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsContent } from "@/components/settings-content"

export default async function SettingsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const [repoLink, settings] = await Promise.all([
    prisma.repoLink.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.settings.findUnique({
      where: { userId: session.user.id },
    }),
  ])

  return (
    <SettingsContent
      user={session.user}
      repoLink={repoLink}
      settings={settings}
    />
  )
}

