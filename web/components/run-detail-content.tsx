"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react"
import { LiveConsole } from "@/components/live-console"
import { CardCarousel } from "@/components/card-carousel"

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
    state: string
    metadata: any
  }>
}

export function RunDetailContent({ run }: { run: Run }) {
  const isRunning = run.status === 'running' || run.status === 'queued'
  const hasCards = run.suggestions.length > 0

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
          </div>
          <p className="text-muted-foreground">
            {run.repo ? `${run.repo.owner}/${run.repo.repo}` : 'Unknown repository'}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-2xl font-bold">{run.filesProcessed ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Files Processed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{run.blocksExtracted ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Blocks Extracted</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{run.notesCreated ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Notes Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{run.notesUpdated ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Notes Updated</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{run.notesSkipped ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Notes Skipped</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                <p>Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Not started'}</p>
                {run.endedAt && (
                  <p>Ended: {new Date(run.endedAt).toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Console Output */}
          <LiveConsole runId={run.id} />

          {/* Card Carousel (when completed with cards) */}
          {!isRunning && hasCards && (
            <>
              <CardCarousel runId={run.id} cards={run.suggestions} />
              
              {/* Download Section */}
              {run.apkgPath && (
                <Card>
                  <CardHeader>
                    <CardTitle>Export Cards</CardTitle>
                    <CardDescription>
                      Download your accepted cards as an Anki package file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a href={`/runs/${run.id}/download`} download>
                      <Button>
                        <Download className="h-4 w-4 mr-2" />
                        Download .apkg File
                      </Button>
                    </a>
                    <p className="text-xs text-muted-foreground mt-2">
                      Import this file into Anki to add the accepted cards to your deck
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
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

