"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, GitBranch, RefreshCw, Code2, AlertCircle, Zap, CheckCircle2 } from "lucide-react"
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
  devMode?: boolean
  syncTarget?: string
  ankiConnectUrl?: string
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
  const [devMode, setDevMode] = useState(settings?.devMode || false)
  const [togglingDevMode, setTogglingDevMode] = useState(false)
  const [syncTarget, setSyncTarget] = useState(settings?.syncTarget || 'apkg')
  const [ankiConnectUrl, setAnkiConnectUrl] = useState(settings?.ankiConnectUrl || 'http://localhost:8765')
  const [testingConnection, setTestingConnection] = useState(false)
  const [savingSync, setSavingSync] = useState(false)

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

  async function handleToggleDevMode(enabled: boolean) {
    try {
      setTogglingDevMode(true)
      const response = await fetch('/api/settings/dev-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devMode: enabled }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update developer mode')
      }

      setDevMode(enabled)
      toast.success(`Developer mode ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setTogglingDevMode(false)
    }
  }

  async function handleTestConnection() {
    try {
      setTestingConnection(true)
      const response = await fetch('/api/anki/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ankiConnectUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Connection test failed')
      }

      const data = await response.json()
      toast.success(`Connected to Anki! Version: ${data.version}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to Anki')
    } finally {
      setTestingConnection(false)
    }
  }

  async function handleSaveSync() {
    try {
      setSavingSync(true)
      const response = await fetch('/api/settings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncTarget,
          ankiConnectUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save sync settings')
      }

      toast.success('Sync settings saved')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingSync(false)
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
            <TabsTrigger value="sync">
              <Zap className="h-3 w-3 mr-1" />
              Sync
            </TabsTrigger>
            <TabsTrigger value="developer">
              <Code2 className="h-3 w-3 mr-1" />
              Developer
            </TabsTrigger>
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

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync Target</CardTitle>
                <CardDescription>
                  Choose how to export your flashcards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={syncTarget} onValueChange={setSyncTarget}>
                  <div className="flex items-start space-x-3 space-y-0">
                    <RadioGroupItem value="apkg" id="apkg" />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="apkg" className="font-semibold cursor-pointer">
                        Download .apkg File (Default)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Export cards as an Anki package file that you can manually import
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 space-y-0">
                    <RadioGroupItem value="ankiconnect" id="ankiconnect" />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="ankiconnect" className="font-semibold cursor-pointer">
                        AnkiConnect (Direct Import)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Push cards directly to Anki using the AnkiConnect add-on
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {syncTarget === 'ankiconnect' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="anki-url">AnkiConnect URL</Label>
                      <Input
                        id="anki-url"
                        type="url"
                        value={ankiConnectUrl}
                        onChange={(e) => setAnkiConnectUrl(e.target.value)}
                        placeholder="http://localhost:8765"
                      />
                      <p className="text-xs text-muted-foreground">
                        Make sure Anki is running with the AnkiConnect add-on installed
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        size="sm"
                      >
                        {testingConnection ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Test Connection
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border border-border bg-muted p-3 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">
                            AnkiConnect Setup
                          </p>
                          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                            <li>Install the <strong>AnkiConnect</strong> add-on in Anki</li>
                            <li>Restart Anki</li>
                            <li>Keep Anki running while using this app</li>
                          </ol>
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 Cards will be automatically synced to the correct deck based on your course configuration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveSync} disabled={savingSync}>
                    {savingSync ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="developer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Developer Mode</CardTitle>
                <CardDescription>
                  Advanced features for testing and development
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="dev-mode" className="text-base font-semibold">
                      Enable Developer Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Unlock advanced features like force reprocessing, verbose logs, and detailed status previews
                    </p>
                  </div>
                  <Switch
                    id="dev-mode"
                    checked={devMode}
                    onCheckedChange={handleToggleDevMode}
                    disabled={togglingDevMode}
                  />
                </div>

                {devMode && (
                  <div className="border border-border bg-muted p-3 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">
                          Developer Mode Active
                        </p>
                        <p className="text-sm text-muted-foreground">
                          You now have access to:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li><strong>Force Reprocess:</strong> Override cached state and reprocess commits</li>
                          <li><strong>Status Preview:</strong> See which commits are new/processed/need re-run</li>
                          <li><strong>Verbose Logs:</strong> More detailed CLI output for debugging</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-3">
                          💡 Tip: Use "Force Reprocess" when testing LLM prompts or checking if deleted files are properly handled.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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

