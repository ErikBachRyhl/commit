"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RepoPicker } from "@/components/repo-picker"
import { CommitSelector } from "@/components/commit-selector"
import { ThemeToggle } from "@/components/theme-toggle"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GitBranch, LogOut, Settings, PlayCircle, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type User = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

type RepoLink = {
  id: string
  owner: string
  repo: string
  yamlPath: string
  defaultBranch: string
}

type Run = {
  id: string
  status: string
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  repo: RepoLink | null
  notesCreated: number | null
  notesUpdated: number | null
}

type Settings = {
  courses: any
  llm: any
  parsing: any
  cards: any
}

export function DashboardContent({
  user,
  linkedRepo,
  settings,
  recentRuns,
}: {
  user: User
  linkedRepo: RepoLink | null
  settings: Settings | null
  recentRuns: Run[]
}) {
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [showCommitSelector, setShowCommitSelector] = useState(false)
  const [linking, setLinking] = useState(false)

  async function handleRepoSelected(repo: any) {
    try {
      setLinking(true)
      const response = await fetch('/api/github/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner.login,
          repo: repo.name,
          yamlPath: 'commit.yml',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to link repository')
      }

      toast.success('Repository linked successfully')
      setShowRepoPicker(false)
      
      // Refresh the page to show the new repo
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || 'Failed to link repository')
    } finally {
      setLinking(false)
    }
  }

  async function handleImportConfig() {
    if (!linkedRepo) return

    try {
      const response = await fetch('/api/settings/import-yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: linkedRepo.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import configuration')
      }

      toast.success('Configuration imported successfully')
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const courses = settings?.courses ? (Array.isArray(settings.courses) ? settings.courses : []) : []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Commit</h1>
            {linkedRepo && (
              <Badge variant="outline" className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {linkedRepo.owner}/{linkedRepo.repo}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!linkedRepo ? (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Commit!</CardTitle>
              <CardDescription>
                Let's get started by linking your GitHub repository containing LaTeX notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowRepoPicker(true)}>
                Link Repository
              </Button>
            </CardContent>
          </Card>
        ) : !settings ? (
          <Card>
            <CardHeader>
              <CardTitle>Import Configuration</CardTitle>
              <CardDescription>
                Import your commit.yml configuration from {linkedRepo.owner}/{linkedRepo.repo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleImportConfig}>
                Import commit.yml
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {/* Courses Section */}
            <Card>
              <CardHeader>
                <CardTitle>Your Courses</CardTitle>
                <CardDescription>
                  {courses.length} course{courses.length !== 1 ? 's' : ''} configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No courses configured yet</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {courses.map((course: any) => (
                      <Card key={course.key}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{course.key}</CardTitle>
                          <CardDescription className="text-xs">
                            Deck: {course.deck}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          <p>{course.paths.length} path{course.paths.length !== 1 ? 's' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Process CTA */}
            <Card>
              <CardHeader>
                <CardTitle>Process Commits</CardTitle>
                <CardDescription>
                  Extract flashcards from your LaTeX changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  size="lg" 
                  className="w-full md:w-auto"
                  onClick={() => setShowCommitSelector(true)}
                >
                  <PlayCircle className="h-5 w-5 mr-2" />
                  Process Now
                </Button>
              </CardContent>
            </Card>

            {/* Recent Runs */}
            {recentRuns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentRuns.map((run) => (
                      <Link key={run.id} href={`/runs/${run.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            {run.status === 'succeeded' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {run.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                            {run.status === 'running' && <Clock className="h-4 w-4 text-blue-500 animate-spin" />}
                            {run.status === 'queued' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                            <div>
                              <p className="text-sm font-medium">
                                {run.repo ? `${run.repo.owner}/${run.repo.repo}` : 'Unknown repo'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(run.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {run.notesCreated !== null && `${run.notesCreated} created`}
                            {run.notesUpdated !== null && `, ${run.notesUpdated} updated`}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Repo Picker Dialog */}
      <Dialog open={showRepoPicker} onOpenChange={setShowRepoPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Repository</DialogTitle>
          </DialogHeader>
          <RepoPicker onRepoSelected={handleRepoSelected} />
        </DialogContent>
      </Dialog>

      {/* Commit Selector Dialog */}
      {linkedRepo && (
        <CommitSelector
          open={showCommitSelector}
          onOpenChange={setShowCommitSelector}
          repoId={linkedRepo.id}
        />
      )}
    </div>
  )
}

