"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Download, StopCircle } from "lucide-react"
import RunConsole from "@/components/run-console"
import { CardCarousel } from "@/components/card-carousel"
import { toast } from "sonner"

type Run = {
  id: string
  status: string
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  filesProcessed: number | null
  blocksExtracted: number | null
  notesCreated: number | null
  notesUpdated: number | null
  notesSkipped: number | null
  apkgPath: string | null
  repo: {
    owner: string
    repo: string
  } | null
  suggestions: Array<{
    id: string
    idx: number
    front: string
    back: string
    tags: string[]
    cardType: string
    sourceFile: string | null
    sourceLine: number | null
    status: string
    frontEdited?: string | null
    backEdited?: string | null
    isEdited?: boolean
    metadata: any
  }>
}

export function RunDetailContent({ run: initialRun }: { run: Run }) {
  const router = useRouter()
  const [killing, setKilling] = useState(false)
  const [run, setRun] = useState(initialRun)
  const [pollFailures, setPollFailures] = useState(0)
  const isRunning = run.status === 'running' || run.status === 'queued'
  const hasCards = run.suggestions.length > 0

  // Poll for status updates when running (with exponential backoff on failures)
  useEffect(() => {
    if (!isRunning) return

    // Calculate delay with exponential backoff: 5s, 10s, 20s, max 30s
    const baseDelay = 5000
    const backoffDelay = Math.min(baseDelay * Math.pow(2, pollFailures), 30000)

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/runs/${run.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.run) {
            setRun(data.run)
            setPollFailures(0) // Reset failures on success
            // If status changed from running, refresh the page to get cards
            if (data.run.status !== 'running' && data.run.status !== 'queued') {
              router.refresh()
            }
          }
        } else {
          setPollFailures(prev => prev + 1)
        }
      } catch (error) {
        console.error('Error polling run status:', error)
        setPollFailures(prev => prev + 1)
      }
    }, backoffDelay)

    return () => clearInterval(interval)
  }, [isRunning, run.id, router, pollFailures])

  const handleKillProcess = async () => {
    if (!confirm('Are you sure you want to stop this process?')) {
      return
    }

    setKilling(true)
    try {
      const response = await fetch(`/api/process/${run.id}/kill`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to kill process')
      }

      toast.success('Process stopped successfully')
      router.refresh()
    } catch (error: any) {
      console.error('Error killing process:', error)
      toast.error(error.message || 'Failed to stop process')
    } finally {
      setKilling(false)
    }
  }

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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Processing Run</h1>
            <div className="flex items-center gap-3">
              <Badge variant={
                run.status === 'succeeded' ? 'default' :
                run.status === 'failed' ? 'destructive' :
                run.status === 'running' ? 'secondary' :
                'outline'
              }>
                {run.status === 'succeeded' && <CheckCircle className="h-3 w-3 mr-1" />}
                {run.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                {run.status === 'running' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                {run.status === 'queued' && <AlertCircle className="h-3 w-3 mr-1" />}
                {run.status}
              </Badge>
              {isRunning && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleKillProcess}
                  disabled={killing}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  {killing ? 'Stopping...' : 'Stop Process'}
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground">
            {run.repo ? `${run.repo.owner}/${run.repo.repo}` : 'Unknown repository'}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Console Output */}
          <Card>
            <CardHeader>
              <CardTitle>Console Output</CardTitle>
              <CardDescription>
                Live output from the processing run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RunConsole runId={run.id} />
            </CardContent>
          </Card>

          {/* Card Carousel (when completed with cards) */}
          {!isRunning && hasCards && (
            <CardCarousel runId={run.id} cards={run.suggestions} />
          )}

          {/* Download Section - Show whenever run succeeded */}
          {!isRunning && run.status === 'succeeded' && (
            <Card>
              <CardHeader>
                <CardTitle>Export Cards</CardTitle>
                <CardDescription>
                  Download your accepted cards as an Anki package file
                </CardDescription>
              </CardHeader>
              <CardContent>
                {run.apkgPath ? (
                  <>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/runs/${run.id}/download`)
                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}))
                            throw new Error(errorData.error || 'Failed to download file')
                          }
                          
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          
                          // Get filename from Content-Disposition header or use default
                          const contentDisposition = response.headers.get('Content-Disposition')
                          let filename = 'notes.apkg'
                          if (contentDisposition) {
                            const filenameMatch = contentDisposition.match(/filename="(.+)"/)
                            if (filenameMatch) {
                              filename = filenameMatch[1]
                            }
                          }
                          
                          a.download = filename
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                          
                          toast.success('Download started!')
                        } catch (error: any) {
                          console.error('Download error:', error)
                          toast.error(error.message || 'Failed to download file')
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download .apkg File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Import this file into Anki to add the accepted cards to your deck
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No .apkg file was generated for this run. This might happen if no cards were created or if the file was cleaned up.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Check the console output above for details about what was processed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isRunning && !hasCards && run.status === 'succeeded' && (
            <Card>
              <CardHeader>
                <CardTitle>No Cards Generated</CardTitle>
                <CardDescription>
                  The processing completed successfully but no cards were generated.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium mb-2">This could happen for several reasons:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>No new commits:</strong> There may be no new or updated LaTeX files since the last run
                    </li>
                    <li>
                      <strong>No extractable environments:</strong> The LaTeX files don't contain any of the environments 
                      specified in your <code className="text-xs bg-muted px-1 py-0.5 rounded">envs_to_extract</code> configuration
                    </li>
                    <li>
                      <strong>High selection conservativeness:</strong> If you have <code className="text-xs bg-muted px-1 py-0.5 rounded">selection_conservativeness</code> set 
                      too high (e.g., &gt; 0.5), the LLM might be filtering out all cards. Try lowering it to 0.1 or 0.2 in your <code className="text-xs bg-muted px-1 py-0.5 rounded">commit.yml</code>
                    </li>
                    <li>
                      <strong>LLM disabled:</strong> Make sure <code className="text-xs bg-muted px-1 py-0.5 rounded">enable_generated: true</code> is set 
                      in your LLM configuration if you want AI-generated cards
                    </li>
                  </ul>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Next steps:</p>
                  <div className="space-y-2">
                    <Link href="/settings">
                      <Button variant="outline" size="sm">
                        Review Settings
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check the console output above for more detailed information about what was processed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {run.status === 'failed' && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Processing Failed</CardTitle>
                <CardDescription>
                  The processing run encountered an error. Check the console output above for details.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

