"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, GitBranch, RefreshCw } from "lucide-react"
import { toast } from "sonner"

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
} | null

type Settings = {
  courses: any
  llm: any
  parsing: any
  cards: any
  rawYaml?: string | null
} | null

export function SettingsContent({
  user,
  repoLink,
  settings,
}: {
  user: User
  repoLink: RepoLink
  settings: Settings
}) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefreshConfig() {
    if (!repoLink) return

    try {
      setRefreshing(true)
      const response = await fetch('/api/settings/import-yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: repoLink.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to refresh configuration')
      }

      toast.success('Configuration refreshed successfully')
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setRefreshing(false)
    }
  }

  const courses = settings?.courses ? (Array.isArray(settings.courses) ? settings.courses : []) : []
  const llm = settings?.llm || {}
  const parsing = settings?.parsing || {}
  const cards = settings?.cards || {}

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your repository and configuration
          </p>
        </div>

        <Tabs defaultValue="repo" className="space-y-6">
          <TabsList>
            <TabsTrigger value="repo">Repository</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="llm">LLM</TabsTrigger>
            <TabsTrigger value="parsing">Parsing</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            {settings?.rawYaml && <TabsTrigger value="yaml">Raw YAML</TabsTrigger>}
          </TabsList>

          <TabsContent value="repo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Linked Repository</CardTitle>
                <CardDescription>
                  Your connected GitHub repository
                </CardDescription>
              </CardHeader>
              <CardContent>
                {repoLink ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {repoLink.owner}/{repoLink.repo}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Branch: {repoLink.defaultBranch}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Config: {repoLink.yamlPath}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshConfig}
                        disabled={refreshing}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh Config
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No repository linked. Go to the dashboard to link one.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Courses Configuration</CardTitle>
                <CardDescription>
                  LaTeX paths mapped to Anki decks
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No courses configured
                  </p>
                ) : (
                  <div className="space-y-4">
                    {courses.map((course: any) => (
                      <div key={course.key} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">{course.key}</h3>
                          <Badge variant="secondary">{course.deck}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium mb-1">Paths:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {course.paths.map((path: string, i: number) => (
                              <li key={i} className="font-mono text-xs">{path}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>LLM Configuration</CardTitle>
                <CardDescription>
                  AI-powered card generation settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Provider</span>
                    <span className="text-sm text-muted-foreground">{llm.provider || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Model</span>
                    <span className="text-sm text-muted-foreground">{llm.model || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Enabled</span>
                    <Badge variant={llm.enable_generated ? 'default' : 'secondary'}>
                      {llm.enable_generated ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Max cards per block</span>
                    <span className="text-sm text-muted-foreground">{llm.max_cards_per_block || 3}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Temperature</span>
                    <span className="text-sm text-muted-foreground">{llm.temperature || 0.2}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parsing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parsing Configuration</CardTitle>
                <CardDescription>
                  LaTeX environment extraction settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium block mb-2">Environments to Extract</span>
                    <div className="flex flex-wrap gap-2">
                      {(parsing.envsToExtract || []).map((env: string) => (
                        <Badge key={env} variant="outline">{env}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Neighbor context lines</span>
                    <span className="text-sm text-muted-foreground">{parsing.neighborContextLines || 20}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cards Configuration</CardTitle>
                <CardDescription>
                  Flashcard generation settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Daily new limit</span>
                    <span className="text-sm text-muted-foreground">{cards.dailyNewLimit || 30}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium block mb-2">Priorities</span>
                    <div className="space-y-1">
                      {Object.entries(cards.priorities || {}).map(([course, priority]) => (
                        <div key={course} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{course}</span>
                          <Badge variant="secondary">{String(priority)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-2">
                      {(cards.tags || []).map((tag: string, i: number) => (
                        <Badge key={i} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {settings?.rawYaml && (
            <TabsContent value="yaml" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Raw YAML</CardTitle>
                  <CardDescription>
                    Original commit.yml content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                    {settings.rawYaml}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}

